import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBodyCapped, validateAudioInput } from './audio.ts';

test('validateAudioInput: accepts a small, allowed, safely-named file', () => {
  const result = validateAudioInput({
    bytes: new Uint8Array(1024),
    mimeType: 'audio/webm',
    filename: 'clip.webm',
  });
  assert.equal(result.ok, true);
});

test('validateAudioInput: rejects a disallowed mime type', () => {
  const result = validateAudioInput({
    bytes: new Uint8Array(1024),
    // @ts-expect-error intentionally invalid for the test
    mimeType: 'text/plain',
    filename: 'clip.webm',
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'unsupported_media_type');
});

test('validateAudioInput: rejects bytes over the cap', () => {
  const result = validateAudioInput({
    bytes: new Uint8Array(4 * 1024 * 1024 + 1),
    mimeType: 'audio/webm',
    filename: 'clip.webm',
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'payload_too_large');
});

test('validateAudioInput: rejects a path-traversal filename', () => {
  const result = validateAudioInput({
    bytes: new Uint8Array(10),
    mimeType: 'audio/webm',
    filename: '../../etc/passwd',
  });
  assert.equal(result.ok, false);
});

// ───────────────────────── readBodyCapped ─────────────────────────

test('readBodyCapped: rejects a Content-Length header over the cap before reading', async () => {
  const req = new Request('https://example.com/upload', {
    method: 'POST',
    headers: { 'content-length': '999999999' },
    body: new Uint8Array(10),
  });
  const result = await readBodyCapped(req, 1024);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'payload_too_large');
});

test('readBodyCapped: aborts when the actual stream exceeds the cap even with a lying content-length', async () => {
  const maxBytes = 10;
  const chunk = new Uint8Array(8).fill(1);
  // A ReadableStream that will yield far more bytes than the small
  // content-length header claims.
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(chunk);
      controller.enqueue(chunk);
      controller.enqueue(chunk);
      controller.close();
    },
  });
  const req = new Request('https://example.com/upload', {
    method: 'POST',
    headers: { 'content-length': '1' }, // lies: claims 1 byte
    body: stream,
    duplex: 'half',
  } as RequestInit);

  const result = await readBodyCapped(req, maxBytes);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'payload_too_large');
});

test('readBodyCapped: accepts a body within the cap and returns its exact bytes', async () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  const req = new Request('https://example.com/upload', { method: 'POST', body: bytes });
  const result = await readBodyCapped(req, 1024);
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(Array.from(result.value), [1, 2, 3, 4, 5]);
});
