// src/lib/pwa/sw.test.ts: exercises public/sw.js (a plain classic service
// worker script, not an ES module) by loading its source into a node:vm
// context with fake self/caches/fetch/Response/URL. node:* imports are
// allowed here because this is a *.test.ts file (plan §7 rule 3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const swSource = readFileSync(
  fileURLToPath(new URL('../../../public/sw.js', import.meta.url)),
  'utf8',
);

const ORIGIN = 'https://example.test';

function absolute(url: string | { url: string }): string {
  return typeof url === 'string' ? new URL(url, ORIGIN).toString() : url.url;
}

interface FakeResponseInit {
  status?: number;
  redirected?: boolean;
  type?: string;
  body?: string;
}

interface FakeResponse {
  status: number;
  redirected: boolean;
  type: string;
  ok: boolean;
  text(): Promise<string>;
  clone(): FakeResponse;
}

function makeResponse(opts: FakeResponseInit = {}): FakeResponse {
  const { status = 200, redirected = false, type = 'basic', body = 'ok' } = opts;
  return {
    status,
    redirected,
    type,
    ok: status >= 200 && status < 300,
    text: async () => body,
    clone() {
      return makeResponse({ status, redirected, type, body });
    },
  };
}

interface FakeRequestInit {
  method?: string;
  mode?: string;
  headers?: Record<string, string>;
}

interface FakeRequest {
  url: string;
  method: string;
  mode: string;
  headers: { get(name: string): string | null };
  clone(): FakeRequest;
}

function makeRequest(url: string, init: FakeRequestInit = {}): FakeRequest {
  const { method = 'GET', mode = 'same-origin', headers = {} } = init;
  const fullUrl = absolute(url);
  return {
    url: fullUrl,
    method,
    mode,
    headers: { get: (name: string) => headers[name] ?? null },
    clone() {
      return makeRequest(fullUrl, { method, mode, headers });
    },
  };
}

function makeFakeSelf() {
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  return {
    addEventListener(type: string, cb: (event: unknown) => void) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(cb);
    },
    dispatch(type: string, event: unknown) {
      for (const cb of listeners.get(type) ?? []) cb(event);
    },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
    location: { origin: ORIGIN },
  };
}

type FetchImpl = (request: FakeRequest) => Promise<FakeResponse>;

function makeFakeCaches(fetchHolder: { impl: FetchImpl }) {
  const stores = new Map<string, Map<string, FakeResponse>>();

  function keyFor(reqOrUrl: string | FakeRequest, ignoreSearch?: boolean): string {
    const url = new URL(absolute(reqOrUrl));
    if (ignoreSearch) url.search = '';
    return url.toString();
  }

  function makeCacheHandle(name: string) {
    if (!stores.has(name)) stores.set(name, new Map());
    const map = stores.get(name)!;
    return {
      async add(url: string | FakeRequest) {
        const request = typeof url === 'string' ? makeRequest(url) : url;
        const response = await fetchHolder.impl(request);
        if (!response.ok) throw new Error(`cache.add failed for ${request.url}`);
        map.set(keyFor(request), response.clone());
      },
      async put(request: FakeRequest, response: FakeResponse) {
        map.set(keyFor(request), response);
      },
      async match(request: string | FakeRequest, opts?: { ignoreSearch?: boolean }) {
        return map.get(keyFor(request, opts?.ignoreSearch));
      },
    };
  }

  return {
    async open(name: string) {
      return makeCacheHandle(name);
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
    async match(request: string | FakeRequest, opts?: { ignoreSearch?: boolean }) {
      for (const map of stores.values()) {
        const hit = map.get(keyFor(request, opts?.ignoreSearch));
        if (hit) return hit;
      }
      return undefined;
    },
    _stores: stores,
  };
}

function makeExtendableEvent() {
  let done: Promise<unknown> = Promise.resolve();
  return {
    waitUntil(p: Promise<unknown>) {
      done = Promise.resolve(p);
    },
    get done() {
      return done;
    },
  };
}

function makeFetchEvent(request: FakeRequest) {
  let result: Promise<FakeResponse> | undefined;
  return {
    request,
    respondWith(p: Promise<FakeResponse> | FakeResponse) {
      result = Promise.resolve(p);
    },
    get result() {
      return result;
    },
  };
}

function createSandbox() {
  const fetchHolder: { impl: FetchImpl } = {
    impl: async () => makeResponse({ status: 404 }),
  };
  const fakeSelf = makeFakeSelf();
  const fakeCaches = makeFakeCaches(fetchHolder);

  const sandbox: Record<string, unknown> = {
    self: fakeSelf,
    caches: fakeCaches,
    fetch: (req: FakeRequest) => fetchHolder.impl(req),
    URL,
    Response: { error: () => makeResponse({ status: 0, type: 'error' }) },
    setTimeout,
    clearTimeout,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(swSource, sandbox as object, { filename: 'sw.js' });
  return { fakeSelf, fakeCaches, fetchHolder };
}

test('install: precaches the list and tolerates one failing URL', async () => {
  const { fakeSelf, fakeCaches, fetchHolder } = createSandbox();
  fetchHolder.impl = async (req) => {
    if (req.url.endsWith('/offline')) return makeResponse({ status: 404 });
    return makeResponse({ status: 200, body: `body:${req.url}` });
  };

  const event = makeExtendableEvent();
  fakeSelf.dispatch('install', event);
  await event.done;

  const precache = fakeCaches._stores.get('pts-precache-v1');
  assert.ok(precache, 'precache cache should exist after install');
  const cachedUrls = [...precache!.keys()];
  assert.ok(cachedUrls.includes(`${ORIGIN}/`), 'root should be precached');
  assert.ok(!cachedUrls.includes(`${ORIGIN}/offline`), 'failing URL should not be cached');
});

test('fetch: /api/* is always network-only and never cached', async () => {
  const { fakeSelf, fakeCaches, fetchHolder } = createSandbox();
  fetchHolder.impl = async () => makeResponse({ status: 200, body: 'chat-response' });

  const event = makeFetchEvent(makeRequest('/api/chat'));
  fakeSelf.dispatch('fetch', event);
  const response = await event.result;

  assert.strictEqual(response?.status, 200);
  for (const map of fakeCaches._stores.values()) assert.strictEqual(map.size, 0);
});

test('fetch: RSC requests (header or query param) are never cached', async () => {
  const { fakeSelf, fakeCaches, fetchHolder } = createSandbox();
  fetchHolder.impl = async () => makeResponse({ status: 200, body: 'rsc-payload' });

  for (const request of [
    makeRequest('/practice', { headers: { RSC: '1' } }),
    makeRequest('/practice?_rsc=abc123'),
  ]) {
    const event = makeFetchEvent(request);
    fakeSelf.dispatch('fetch', event);
    await event.result;
  }

  for (const map of fakeCaches._stores.values()) assert.strictEqual(map.size, 0);
});

test('fetch: redirected and non-200 responses are never cache.put', async () => {
  const { fakeSelf, fakeCaches, fetchHolder } = createSandbox();
  fetchHolder.impl = async (req) => {
    if (req.url.endsWith('/redirect-me')) return makeResponse({ status: 200, redirected: true });
    return makeResponse({ status: 500 });
  };

  for (const path of ['/redirect-me', '/broken']) {
    const event = makeFetchEvent(makeRequest(path));
    fakeSelf.dispatch('fetch', event);
    await event.result;
  }

  const runtime = fakeCaches._stores.get('pts-runtime-v1');
  assert.ok(!runtime || runtime.size === 0);
});

test('navigation offline fallback: /?source=pwa serves the cached / (ignoreSearch)', async () => {
  const { fakeSelf, fakeCaches, fetchHolder } = createSandbox();
  const precache = await fakeCaches.open('pts-precache-v1');
  await precache.put(makeRequest('/'), makeResponse({ status: 200, body: 'home' }));
  fetchHolder.impl = async () => {
    throw new Error('offline');
  };

  const event = makeFetchEvent(makeRequest('/?source=pwa', { mode: 'navigate' }));
  fakeSelf.dispatch('fetch', event);
  const response = await event.result;

  assert.strictEqual(await response?.text(), 'home');
});

test('navigation offline fallback: an unknown page serves /offline', async () => {
  const { fakeSelf, fakeCaches, fetchHolder } = createSandbox();
  const precache = await fakeCaches.open('pts-precache-v1');
  await precache.put(makeRequest('/offline'), makeResponse({ status: 200, body: 'offline-shell' }));
  fetchHolder.impl = async () => {
    throw new Error('offline');
  };

  const event = makeFetchEvent(makeRequest('/some/unknown/page', { mode: 'navigate' }));
  fakeSelf.dispatch('fetch', event);
  const response = await event.result;

  assert.strictEqual(await response?.text(), 'offline-shell');
});

test('activate: deletes caches that are not the current version', async () => {
  const { fakeSelf, fakeCaches } = createSandbox();
  await fakeCaches.open('pts-precache-v0-old');
  await fakeCaches.open('pts-runtime-v0-old');
  await fakeCaches.open('pts-precache-v1');

  const event = makeExtendableEvent();
  fakeSelf.dispatch('activate', event);
  await event.done;

  const keys = (await fakeCaches.keys()).sort();
  assert.deepStrictEqual(keys, ['pts-precache-v1']);
});
