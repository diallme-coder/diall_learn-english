import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkOrigin } from './origin.ts';

const ALLOWED = ['https://parle-to-speak.app', 'https://staging.parle-to-speak.app'];

test('checkOrigin: no Origin header is allowed (same-origin request)', () => {
  assert.equal(checkOrigin(null, ALLOWED), true);
});

test('checkOrigin: an allowlisted origin is allowed', () => {
  assert.equal(checkOrigin('https://parle-to-speak.app', ALLOWED), true);
});

test('checkOrigin: a foreign origin is denied', () => {
  assert.equal(checkOrigin('https://evil.example.com', ALLOWED), false);
});

test('checkOrigin: a near-match (subdomain spoof) is denied', () => {
  assert.equal(checkOrigin('https://parle-to-speak.app.evil.com', ALLOWED), false);
});
