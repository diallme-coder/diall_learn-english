import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchBytes, fetchJson, type FetchImpl } from './fetchJson.ts';

function okJsonFetch(body: unknown): FetchImpl {
  return (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as FetchImpl;
}

test('fetchJson: happy path returns the parsed body', async () => {
  const result = await fetchJson<{ a: number }>('https://example.com', {
    timeoutMs: 1000,
    fetchImpl: okJsonFetch({ a: 1 }),
    retry: false,
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value, { a: 1 });
});

test('fetchJson: a 500 is mapped to upstream_error (no body leaked)', async () => {
  const fetchImpl = (async () => new Response('secret upstream details', { status: 500 })) as unknown as FetchImpl;
  const result = await fetchJson('https://example.com', { timeoutMs: 1000, fetchImpl, retry: false });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'upstream_error');
    assert.ok(!result.error.message.includes('secret upstream details'));
  }
});

test('fetchJson: an AbortError (timeout) is mapped to upstream_timeout', async () => {
  const fetchImpl = (async () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    throw err;
  }) as unknown as FetchImpl;
  const result = await fetchJson('https://example.com', { timeoutMs: 10, fetchImpl, retry: false });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'upstream_timeout');
});

test('fetchJson: retries once on 429, then succeeds', async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    if (calls === 1) return new Response('rate limited', { status: 429 });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as unknown as FetchImpl;
  const result = await fetchJson<{ ok: boolean }>('https://example.com', { timeoutMs: 1000, fetchImpl, retry: true });
  assert.equal(calls, 2);
  assert.equal(result.ok, true);
});

test('fetchBytes: returns raw bytes on success', async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const fetchImpl = (async () => new Response(bytes, { status: 200 })) as unknown as FetchImpl;
  const result = await fetchBytes('https://example.com', { timeoutMs: 1000, fetchImpl, retry: false });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual([...result.value], [1, 2, 3]);
});
