import { test } from 'node:test';
import assert from 'node:assert/strict';
import { corsHeaders, errorResponse, jsonResponse } from './http.ts';

test('jsonResponse: sets content-type and no-store', () => {
  const res = jsonResponse({ ok: true });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/json');
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('errorResponse: maps every AppErrorCode to its HTTP status', async () => {
  const cases: Array<[string, number]> = [
    ['bad_request', 400], ['unauthorized', 401], ['forbidden', 403], ['not_found', 404],
    ['payload_too_large', 413], ['unsupported_media_type', 415], ['rate_limited', 429],
    ['upstream_error', 502], ['upstream_timeout', 504], ['internal', 500],
  ];
  for (const [code, status] of cases) {
    const res = errorResponse({ code: code as never, message: 'x' });
    assert.equal(res.status, status, code);
    const body = await res.json();
    assert.equal(body.error.code, code);
  }
});

test('errorResponse: sets retry-after when the error carries one', () => {
  const res = errorResponse({ code: 'rate_limited', message: 'slow down', retryAfterSec: 42 });
  assert.equal(res.headers.get('retry-after'), '42');
});

test('corsHeaders: empty for a foreign/missing origin, set for an allowed one', () => {
  const allowed = ['https://parle-to-speak.app'];
  assert.deepEqual(corsHeaders(null, allowed), {});
  assert.deepEqual(corsHeaders('https://evil.example.com', allowed), {});
  assert.deepEqual(corsHeaders('https://parle-to-speak.app', allowed), {
    'access-control-allow-origin': 'https://parle-to-speak.app',
    vary: 'origin',
  });
});
