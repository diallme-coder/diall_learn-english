import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseAuth } from './supabaseAuth.ts';
import { fakeJwt } from '../fixtures/requests.ts';
import type { FetchImpl } from '../fetchJson.ts';

const NOW_MS = Date.UTC(2026, 10, 22, 12, 0, 0);

test('createSupabaseAuth: an expired token (exp in SECONDS) is rejected without calling the network', async () => {
  let calls = 0;
  const fetchImpl: FetchImpl = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ id: 'u1' }), { status: 200 });
  }) as unknown as FetchImpl;
  const auth = createSupabaseAuth({ supabaseUrl: 'https://proj.supabase.co', anonKey: 'anon', fetchImpl });

  const expiredToken = fakeJwt({ exp: Math.floor(NOW_MS / 1000) - 1 });
  const result = await auth.verify(`Bearer ${expiredToken}`, NOW_MS);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'unauthorized');
  assert.equal(calls, 0, 'the network verifier must never be called for a precheck-failed token');
});

test('createSupabaseAuth: a valid token resolves userId from GoTrue', async () => {
  let capturedHeaders: Record<string, string> | undefined;
  const fetchImpl: FetchImpl = (async (_url: string, init?: RequestInit) => {
    capturedHeaders = init?.headers as Record<string, string>;
    return new Response(JSON.stringify({ id: 'user-123' }), { status: 200 });
  }) as unknown as FetchImpl;
  const auth = createSupabaseAuth({ supabaseUrl: 'https://proj.supabase.co', anonKey: 'anon-key', fetchImpl });

  const token = fakeJwt({ exp: Math.floor(NOW_MS / 1000) + 3600 });
  const result = await auth.verify(`Bearer ${token}`, NOW_MS);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.userId, 'user-123');
    assert.equal(result.value.accessToken, token);
  }
  assert.equal(capturedHeaders!.apikey, 'anon-key');
});

test('createSupabaseAuth: a negative (upstream-rejected) result is cached for 10s, then re-checked', async () => {
  let calls = 0;
  const fetchImpl: FetchImpl = (async () => {
    calls += 1;
    return new Response('nope', { status: 401 });
  }) as unknown as FetchImpl;
  const auth = createSupabaseAuth({ supabaseUrl: 'https://proj.supabase.co', anonKey: 'anon', fetchImpl });
  const token = fakeJwt({ exp: Math.floor(NOW_MS / 1000) + 3600 });
  const header = `Bearer ${token}`;

  const first = await auth.verify(header, NOW_MS);
  assert.equal(first.ok, false);
  assert.equal(calls, 1);

  // Within the 10s cache window: no new network call.
  const second = await auth.verify(header, NOW_MS + 5000);
  assert.equal(second.ok, false);
  assert.equal(calls, 1);

  // Past the 10s window: re-checks the network.
  const third = await auth.verify(header, NOW_MS + 10001);
  assert.equal(third.ok, false);
  assert.equal(calls, 2);
});

test('createSupabaseAuth: a malformed (non-3-part) token is rejected without calling the network', async () => {
  let calls = 0;
  const fetchImpl: FetchImpl = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ id: 'u1' }), { status: 200 });
  }) as unknown as FetchImpl;
  const auth = createSupabaseAuth({ supabaseUrl: 'https://proj.supabase.co', anonKey: 'anon', fetchImpl });
  const result = await auth.verify('Bearer not-a-jwt', NOW_MS);
  assert.equal(result.ok, false);
  assert.equal(calls, 0);
});
