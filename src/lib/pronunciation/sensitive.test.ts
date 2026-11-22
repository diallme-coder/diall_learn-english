import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTrap } from './traps.ts';
import {
  isSensitiveWord,
  filterSensitivePairs,
  filterSensitiveWords,
  tapToRevealNote,
  revealConfusedWith,
} from './sensitive.ts';

test('isSensitiveWord: positive and negative, case-insensitive', () => {
  assert.strictEqual(isSensitiveWord('bitch'), true);
  assert.strictEqual(isSensitiveWord('BITCH'), true);
  assert.strictEqual(isSensitiveWord('  Bitch  '), true);
  assert.strictEqual(isSensitiveWord('beach'), false);
  assert.strictEqual(isSensitiveWord('sheep'), false);
});

test('filterSensitivePairs drops the sensitive pair only', () => {
  const trap = getTrap('ih_vs_iy');
  const filtered = filterSensitivePairs(trap.minimalPairs);
  assert.ok(filtered.every((p) => !p.sensitive));
  assert.ok(!filtered.some((p) => p.target === 'beach'));
  assert.strictEqual(filtered.length, trap.minimalPairs.length - 1);
});

test('filterSensitiveWords drops only the sensitive word', () => {
  const words = ['beach', 'ship', 'bitch', 'sheep'];
  assert.deepStrictEqual(filterSensitiveWords(words), ['beach', 'ship', 'sheep']);
});

test('tapToRevealNote: null for non-sensitive pairs, a note (without the rude word) for the sensitive one', () => {
  const trap = getTrap('ih_vs_iy');
  const sensitivePair = trap.minimalPairs.find((p) => p.sensitive);
  assert.ok(sensitivePair);
  const nonSensitivePair = trap.minimalPairs.find((p) => !p.sensitive);
  assert.ok(nonSensitivePair);

  assert.strictEqual(tapToRevealNote(nonSensitivePair), null);

  const note = tapToRevealNote(sensitivePair);
  assert.ok(note);
  assert.strictEqual(note?.sensitive, true);
  assert.ok(!note?.noteFr.toLowerCase().includes(sensitivePair.confusedWith.toLowerCase()));
});

test('revealConfusedWith: non-sensitive pair always returned; sensitive pair requires explicit opt-in', () => {
  const trap = getTrap('ih_vs_iy');
  const sensitivePair = trap.minimalPairs.find((p) => p.sensitive);
  const nonSensitivePair = trap.minimalPairs.find((p) => !p.sensitive);
  assert.ok(sensitivePair && nonSensitivePair);

  assert.strictEqual(revealConfusedWith(nonSensitivePair, false), nonSensitivePair.confusedWith);
  assert.strictEqual(revealConfusedWith(sensitivePair, false), null);
  assert.strictEqual(revealConfusedWith(sensitivePair, true), sensitivePair.confusedWith);
});
