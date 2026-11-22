import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeWithOffsets } from './tokenize.ts';

test('tokenizes simple words with correct offsets', () => {
  const text = 'I think so';
  const tokens = tokenizeWithOffsets(text);
  assert.deepStrictEqual(tokens.map((t) => t.token), ['I', 'think', 'so']);
  for (const t of tokens) {
    assert.strictEqual(text.slice(t.start, t.end), t.token);
  }
});

test('strips surrounding punctuation but keeps internal apostrophes (contractions)', () => {
  const text = "Don't worry, it's fine.";
  const tokens = tokenizeWithOffsets(text);
  assert.deepStrictEqual(tokens.map((t) => t.token), ["Don't", 'worry', "it's", 'fine']);
  for (const t of tokens) {
    assert.strictEqual(text.slice(t.start, t.end), t.token);
  }
});

test('offsets are into the original string even with leading/trailing whitespace', () => {
  const text = '  this  is   my ship  ';
  const tokens = tokenizeWithOffsets(text);
  assert.deepStrictEqual(tokens.map((t) => t.token), ['this', 'is', 'my', 'ship']);
  for (const t of tokens) {
    assert.strictEqual(text.slice(t.start, t.end), t.token);
  }
});

test('an isolated single word tokenizes to one token', () => {
  const tokens = tokenizeWithOffsets('think');
  assert.strictEqual(tokens.length, 1);
  assert.deepStrictEqual(tokens[0], { token: 'think', start: 0, end: 5 });
});
