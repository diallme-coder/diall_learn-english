import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClientIp } from './clientIp.ts';

// X-Forwarded-For semantics: each proxy appends the address of whoever
// connected directly to it. So the entries closest to the right are added
// by the proxies nearest to us; the leftmost entries (if any) were
// supplied by the client itself and are NOT trustworthy. With
// `trustedProxyHops` trusted reverse proxies directly in front of us, the
// genuine client IP sits at `ips.length - trustedProxyHops` (0-indexed
// from the left) — appended by the first trusted proxy, which directly
// observed the real client's connection.

function headersFrom(values: Record<string, string>) {
  return { get: (name: string) => values[name.toLowerCase()] ?? null };
}

test('parseClientIp: prefers x-real-ip when present', () => {
  const headers = headersFrom({ 'x-real-ip': '203.0.113.5', 'x-forwarded-for': '10.0.0.1, 203.0.113.9' });
  assert.equal(parseClientIp(headers), '203.0.113.5');
});

test('parseClientIp: with no headers at all, returns null (skips the IP bucket)', () => {
  const headers = headersFrom({});
  assert.equal(parseClientIp(headers), null);
});

test('parseClientIp: a single-entry x-forwarded-for with 1 trusted hop is the client IP', () => {
  // Our one trusted proxy received the request directly from the client
  // and appended the client's real IP as the only entry.
  const headers = headersFrom({ 'x-forwarded-for': '198.51.100.23' });
  assert.equal(parseClientIp(headers, 1), '198.51.100.23');
});

test('parseClientIp: a 2-entry x-forwarded-for with 1 trusted hop uses the rightmost entry', () => {
  // XFF = "<client-supplied, untrustworthy>, <appended by our trusted proxy>"
  const headers = headersFrom({ 'x-forwarded-for': '198.51.100.23, 203.0.113.9' });
  assert.equal(parseClientIp(headers, 1), '203.0.113.9');
});

test('parseClientIp: a 3-entry x-forwarded-for with 2 trusted hops walks 2 in from the right', () => {
  // XFF = "<untrustworthy>, <added by our 1st trusted proxy = real client>, <added by our 2nd trusted proxy>"
  const headers = headersFrom({ 'x-forwarded-for': '198.51.100.23, 203.0.113.9, 10.0.0.1' });
  assert.equal(parseClientIp(headers, 2), '203.0.113.9');
});

test('parseClientIp: trustedProxyHops beyond the list length returns null', () => {
  const headers = headersFrom({ 'x-forwarded-for': '198.51.100.23, 203.0.113.9' });
  assert.equal(parseClientIp(headers, 5), null);
});

test('parseClientIp: trims whitespace around entries', () => {
  const headers = headersFrom({ 'x-forwarded-for': ' 198.51.100.23 ,  203.0.113.9 ' });
  assert.equal(parseClientIp(headers, 1), '203.0.113.9');
});
