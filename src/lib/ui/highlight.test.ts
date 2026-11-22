import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightForStatus } from './highlight.ts';
import type { WordScoreStatus } from '../types.ts';

test('each status maps to a distinct, non-color-dependent descriptor', () => {
  const statuses: WordScoreStatus[] = ['ok', 'warn', 'error', 'unsure'];
  const descriptors = statuses.map((s) => highlightForStatus(s));

  const patterns = descriptors.map((d) => d.pattern);
  assert.strictEqual(new Set(patterns).size, patterns.length, 'patterns must be distinct per status');

  const glyphs = descriptors.map((d) => d.glyph);
  assert.strictEqual(new Set(glyphs.map((g) => g ?? 'none')).size, glyphs.length, 'glyphs must be distinct per status (including null)');
});

test('ok/warn/error/unsure use their documented pattern and glyph', () => {
  assert.deepStrictEqual(highlightForStatus('ok').pattern, 'dotted-underline');
  assert.deepStrictEqual(highlightForStatus('ok').glyph, 'check');
  assert.deepStrictEqual(highlightForStatus('warn').pattern, 'wavy-underline');
  assert.deepStrictEqual(highlightForStatus('warn').glyph, 'tilde');
  assert.deepStrictEqual(highlightForStatus('error').pattern, 'double-underline');
  assert.deepStrictEqual(highlightForStatus('error').glyph, 'cross');
  assert.strictEqual(highlightForStatus('error').bold, true);
  assert.deepStrictEqual(highlightForStatus('unsure').pattern, 'dashed-underline');
});

test('unsure never uses a glyph and never uses the error color token', () => {
  const unsure = highlightForStatus('unsure');
  assert.strictEqual(unsure.glyph, null);
  assert.notStrictEqual(unsure.colorToken, highlightForStatus('error').colorToken);
});

test('aria label carries the meaning in words, not just color', () => {
  const ok = highlightForStatus('ok');
  assert.ok(ok.ariaLabel.length > 0);
});
