import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withGuards } from './common.ts';
import { buildFakeDeps } from '../deps.ts';
import { bearerFor, fakeJwt, makeGetRequest } from '../fixtures/requests.ts';
import { createFakeAuth } from '../../lib/ports/index.ts';

const URL = 'https://parle-to-speak.app/api/progress';
const ORIGIN = 'https://parle-to-speak.app';

test('withGuards: a foreign origin is 403, not 401 (origin before auth)', async () => {
  const deps = buildFakeDeps({ allowedOrigins: [ORIGIN] });
  const req = makeGetRequest(URL, { origin: 'https://evil.example.com' });
  const res = await withGuards(req, deps, { route: 'progress', methods: ['GET'] }, async () => new Response('never'));
  assert.equal(res.status, 403);
});

test('withGuards: a method not in the allowlist is rejected before origin/auth', async () => {
  const deps = buildFakeDeps({ allowedOrigins: [ORIGIN] });
  const req = new Request(URL, { method: 'DELETE', headers: { origin: ORIGIN } });
  const res = await withGuards(req, deps, { route: 'progress', methods: ['GET'] }, async () => new Response('never'));
  assert.equal(res.status, 400);
});

test('withGuards: IP-limited is 429 without ever calling auth.verify', async () => {
  const deps = buildFakeDeps({ allowedOrigins: [ORIGIN], rateLimitPolicy: 'deny' });
  const authSpy = createFakeAuth({});
  deps.auth = authSpy;
  const req = new Request(URL, {
    method: 'GET',
    headers: { origin: ORIGIN, 'x-real-ip': '1.2.3.4', authorization: bearerFor({ exp: 9999999999 }) },
  });
  const res = await withGuards(req, deps, { route: 'progress', methods: ['GET'] }, async () => new Response('never'));
  assert.equal(res.status, 429);
  assert.equal(authSpy.calls.length, 0);
});

test('withGuards: a missing bearer token is 401', async () => {
  const deps = buildFakeDeps({ allowedOrigins: [ORIGIN] });
  const req = makeGetRequest(URL, { origin: ORIGIN });
  const res = await withGuards(req, deps, { route: 'progress', methods: ['GET'] }, async () => new Response('never'));
  assert.equal(res.status, 401);
});

test('withGuards: a malformed/expired token is 401 without calling auth.verify', async () => {
  const deps = buildFakeDeps({ allowedOrigins: [ORIGIN] });
  const authSpy = createFakeAuth({});
  deps.auth = authSpy;
  const expired = bearerFor({ exp: Math.floor(Date.now() / 1000) - 60 });
  const req = makeGetRequest(URL, { origin: ORIGIN, authorization: expired });
  const res = await withGuards(req, deps, { route: 'progress', methods: ['GET'] }, async () => new Response('never'));
  assert.equal(res.status, 401);
  assert.equal(authSpy.calls.length, 0);
});

test('withGuards: an unknown (but well-formed) token is 401, auth.verify IS called', async () => {
  const deps = buildFakeDeps({ allowedOrigins: [ORIGIN] });
  const token = bearerFor({ exp: Math.floor(Date.now() / 1000) + 3600 });
  const req = makeGetRequest(URL, { origin: ORIGIN, authorization: token });
  const res = await withGuards(req, deps, { route: 'progress', methods: ['GET'] }, async () => new Response('never'));
  assert.equal(res.status, 401);
});

test('withGuards: a valid auth passes through to the handler', async () => {
  const deps = buildFakeDeps({ allowedOrigins: [ORIGIN] });
  const goodToken = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
  deps.auth = createFakeAuth({ [goodToken]: { userId: 'u1', accessToken: goodToken } });
  const req = makeGetRequest(URL, { origin: ORIGIN, authorization: `Bearer ${goodToken}` });
  const res = await withGuards(req, deps, { route: 'progress', methods: ['GET'] }, async (ctx) => {
    assert.equal(ctx.auth.userId, 'u1');
    return new Response('ok');
  });
  assert.equal(await res.text(), 'ok');
});

test('withGuards: user-scope rate limiting is 429 after a valid auth', async () => {
  const deps = buildFakeDeps({ allowedOrigins: [ORIGIN], rateLimitPolicy: 'allow' });
  const goodToken = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
  deps.auth = createFakeAuth({ [goodToken]: { userId: 'u1', accessToken: goodToken } });
  // Swap the limiter to deny only user-scope.
  deps.limiter = {
    take: (scope) => (scope === 'user' ? { allowed: false, remaining: 0, retryAfterSec: 10 } : { allowed: true, remaining: 1, retryAfterSec: 0 }),
  };
  const req = makeGetRequest(URL, { origin: ORIGIN, authorization: `Bearer ${goodToken}` });
  const res = await withGuards(req, deps, { route: 'progress', methods: ['GET'] }, async () => new Response('never'));
  assert.equal(res.status, 429);
});
