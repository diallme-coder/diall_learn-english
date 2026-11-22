import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickRecorderMime, pickRecorderBaseMime, DEFAULT_MIME_CANDIDATES } from './recorderMime.ts';

test('picks the first supported candidate from LIMITS.allowedAudioMime, in priority order', () => {
  const picked = pickRecorderMime(() => true);
  assert.strictEqual(picked, DEFAULT_MIME_CANDIDATES[0]);
});

test('skips unsupported candidates and picks the next one', () => {
  const supported = new Set(['audio/mp4']);
  const picked = pickRecorderMime((m) => supported.has(m));
  assert.strictEqual(picked, 'audio/mp4');
});

test('returns null when nothing is supported', () => {
  assert.strictEqual(pickRecorderMime(() => false), null);
});

test('rejects a candidate whose base type is not in LIMITS.allowedAudioMime', () => {
  const picked = pickRecorderMime(() => true, ['audio/flac', 'audio/mp4']);
  assert.strictEqual(picked, 'audio/mp4');
});

test('pickRecorderBaseMime strips the codecs suffix', () => {
  assert.strictEqual(pickRecorderBaseMime(() => true), 'audio/webm');
});
