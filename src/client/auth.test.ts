import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthClient, needsRefresh, toAuthSession, type AuthStorage } from './auth.ts';

function memoryStorage(): AuthStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

test('toAuthSession converts a GoTrue token response, expiresAt = now + expires_in', () => {
  const session = toAuthSession({ access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: 'u1' } }, 1000);
  assert.strictEqual(session.accessToken, 'a');
  assert.strictEqual(session.refreshToken, 'r');
  assert.strictEqual(session.expiresAt, 1000 + 3600 * 1000);
  assert.strictEqual(session.userId, 'u1');
});

test('needsRefresh is true inside the skew window, false well before expiry', () => {
  const session = toAuthSession({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }, 0);
  assert.strictEqual(needsRefresh(session, 0), false);
  assert.strictEqual(needsRefresh(session, session.expiresAt - 61_000), false);
  assert.strictEqual(needsRefresh(session, session.expiresAt - 59_000), true);
  assert.strictEqual(needsRefresh(session, session.expiresAt), true);
});

test('signInWithOtp posts {email, create_user: true} to /auth/v1/otp', async () => {
  const calls: { url: string; body: unknown }[] = [];
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof fetch;

  const client = createAuthClient({ supabaseUrl: 'https://x.supabase.co', apiKey: 'anon', fetchFn: fakeFetch });
  const result = await client.signInWithOtp('a@b.com');

  assert.strictEqual(result.ok, true);
  assert.strictEqual(calls[0]?.url, 'https://x.supabase.co/auth/v1/otp');
  assert.deepStrictEqual(calls[0]?.body, { email: 'a@b.com', create_user: true });
});

test('verifyOtp stores the session and getAccessToken returns it when fresh', async () => {
  const storage = memoryStorage();
  const fakeFetch = (async () =>
    new Response(JSON.stringify({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600, user: { id: 'u1' } }), {
      status: 200,
    })) as typeof fetch;

  const client = createAuthClient({
    supabaseUrl: 'https://x.supabase.co',
    apiKey: 'anon',
    fetchFn: fakeFetch,
    storage,
    clock: { now: () => 0 },
  });

  const result = await client.verifyOtp('a@b.com', '123456');
  assert.strictEqual(result.ok, true);
  assert.strictEqual(await client.getAccessToken(), 'tok');
  assert.ok(storage.getItem('pts:auth-session') !== null, 'session persisted to storage');
});

test('getAccessToken refreshes when inside the skew window', async () => {
  let refreshCalls = 0;
  const fakeFetch = (async (url: string) => {
    if (url.includes('grant_type=refresh_token')) {
      refreshCalls++;
      return new Response(JSON.stringify({ access_token: 'tok2', refresh_token: 'ref2', expires_in: 3600 }), { status: 200 });
    }
    return new Response(JSON.stringify({ access_token: 'tok1', refresh_token: 'ref1', expires_in: 100 }), { status: 200 });
  }) as typeof fetch;

  let now = 0;
  const client = createAuthClient({
    supabaseUrl: 'https://x.supabase.co',
    apiKey: 'anon',
    fetchFn: fakeFetch,
    clock: { now: () => now },
  });

  await client.verifyOtp('a@b.com', '123456'); // expires at now(0) + 100_000ms
  now = 100_000 - 59_000; // inside the 60s skew window
  const token = await client.getAccessToken();
  assert.strictEqual(refreshCalls, 1);
  assert.strictEqual(token, 'tok2');
});
