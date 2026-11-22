import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeJwtPayload, precheckJwtExpiry } from './jwt.ts';

function base64UrlEncode(json: unknown): string {
  const str = JSON.stringify(json);
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fakeJwt(payload: Record<string, unknown>): string {
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' });
  const body = base64UrlEncode(payload);
  return `${header}.${body}.fakesignature`;
}

const NOW_MS = Date.UTC(2026, 10, 22, 12, 0, 0);

test('decodeJwtPayload: decodes a well-formed token', () => {
  const token = fakeJwt({ sub: 'abc', exp: 123 });
  const payload = decodeJwtPayload(token);
  assert.deepEqual(payload, { sub: 'abc', exp: 123 });
});

test('decodeJwtPayload: returns null for a malformed token', () => {
  assert.equal(decodeJwtPayload('not-a-jwt'), null);
  assert.equal(decodeJwtPayload('a.b'), null);
  assert.equal(decodeJwtPayload('a.!!!notbase64!!!.c'), null);
});

// ───────────────────────── the exp-in-seconds bug class ─────────────────────────

test('precheckJwtExpiry: a token expiring 60s in the future (exp in SECONDS) passes', () => {
  const expSeconds = Math.floor(NOW_MS / 1000) + 60;
  const token = fakeJwt({ sub: '11111111-1111-1111-1111-111111111111', exp: expSeconds, aud: 'authenticated' });
  assert.equal(precheckJwtExpiry(token, NOW_MS), true);
});

test('precheckJwtExpiry: a token that expired 1s ago fails', () => {
  const expSeconds = Math.floor(NOW_MS / 1000) - 1;
  const token = fakeJwt({ sub: '11111111-1111-1111-1111-111111111111', exp: expSeconds, aud: 'authenticated' });
  assert.equal(precheckJwtExpiry(token, NOW_MS), false);
});

test('precheckJwtExpiry: catches the "exp compared without *1000" bug class directly', () => {
  // If the implementation forgot to convert exp (seconds) to ms, then for
  // any realistic millisecond `nowMs` (~1.7e12), a seconds-scale exp
  // (~1.7e9) would ALWAYS compare as expired, even for a token that is
  // actually valid for a long time yet. This proves the conversion happens.
  const farFutureExpSeconds = Math.floor(NOW_MS / 1000) + 3600; // 1 hour from now, in seconds
  const token = fakeJwt({ sub: 'x', exp: farFutureExpSeconds });
  assert.equal(precheckJwtExpiry(token, NOW_MS), true);
});

test('precheckJwtExpiry: a missing or non-numeric exp fails closed', () => {
  assert.equal(precheckJwtExpiry(fakeJwt({ sub: 'x' }), NOW_MS), false);
  assert.equal(precheckJwtExpiry(fakeJwt({ sub: 'x', exp: 'soon' }), NOW_MS), false);
});
