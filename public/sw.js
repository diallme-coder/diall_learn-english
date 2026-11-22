// public/sw.js: plain classic service worker (no bundler, no imports).
// The PRECACHE array below is rewritten in place by scripts/gen-precache.mjs
// after `next build`, between the markers. Keep the markers on their own
// lines exactly as below; gen-precache.mjs matches them literally.

const CACHE_VERSION = 'v1';
const PRECACHE_CACHE = `pts-precache-${CACHE_VERSION}`;
const RUNTIME_CACHE = `pts-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';
const NAVIGATION_TIMEOUT_MS = 3000;

/*PRECACHE_START*/
const PRECACHE = ["/","/offline","/drills","/practice/shadowing","/pronunciation"];
/*PRECACHE_END*/

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE_CACHE);
      // Tolerant per-URL add: one failing URL (e.g. a stale chunk hash)
      // must not abort the whole install.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            await cache.add(url);
          } catch (err) {
            // Swallow: this URL is simply not precached this time.
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== PRECACHE_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isRscRequest(request, url) {
  if (request.headers.get('RSC') === '1') return true;
  if (url.searchParams.has('_rsc')) return true;
  return false;
}

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/');
}

// A response is cacheable only if it is a plain, successful, non-redirected
// same-origin response. Opaque (cross-origin, no-cors) responses, redirects
// and non-200 statuses are never cache.put.
function isCacheable(response) {
  if (!response) return false;
  if (response.redirected) return false;
  if (response.status !== 200) return false;
  if (response.type === 'opaque') return false;
  return true;
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) {
    const cache = await caches.open(RUNTIME_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (isCacheable(response)) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  if (cached) {
    // Fire-and-forget the revalidation; return the cached copy immediately.
    networkPromise.catch(() => undefined);
    return cached;
  }
  const network = await networkPromise;
  return network ?? Response.error();
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function navigationHandler(request) {
  try {
    const response = await Promise.race([fetch(request), timeout(NAVIGATION_TIMEOUT_MS)]);
    if (isCacheable(response)) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // (a) API routes: never cached, always network.
  if (isApiRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // (b) RSC payload requests: never cached, always network.
  if (isRscRequest(request, url)) {
    event.respondWith(fetch(request));
    return;
  }

  // (d) navigations: network-first with a timeout, then cache (ignoring the
  // query string, so `/?source=pwa` falls back to the cached `/`), then
  // the offline shell.
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  // (c) static build assets and icons: cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // (e) everything else same-origin: stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(request));
});
