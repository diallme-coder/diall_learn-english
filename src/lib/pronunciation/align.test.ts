import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { TranscriptWord } from '../types.ts';
import { alignWords } from './align.ts';

function w(text: string, startSec = 0, endSec = 0.5, confidence?: number): TranscriptWord {
  const word: TranscriptWord = { text, startSec, endSec };
  return confidence === undefined ? word : { ...word, confidence };
}

test('all-match alignment: one entry per expected word, op "match"', () => {
  const expected = ['I', 'think', 'so'];
  const heard = [w('I'), w('think'), w('so')];
  const aligned = alignWords(expected, heard).filter((a) => a.expectedIndex !== null);
  assert.strictEqual(aligned.length, 3);
  for (const a of aligned) assert.strictEqual(a.op, 'match');
});

test('substitution is detected when a word differs', () => {
  const expected = ['think'];
  const heard = [w('sink')];
  const aligned = alignWords(expected, heard);
  assert.strictEqual(aligned.length, 1);
  assert.strictEqual(aligned[0]?.op, 'substitute');
  assert.strictEqual(aligned[0]?.heard?.text, 'sink');
});

test('a missing word becomes a deletion (heard: null)', () => {
  const expected = ['I', 'think', 'so'];
  const heard = [w('I'), w('so')];
  const aligned = alignWords(expected, heard).filter((a) => a.expectedIndex !== null);
  assert.strictEqual(aligned.length, 3);
  const deletion = aligned.find((a) => a.expected === 'think');
  assert.ok(deletion);
  assert.strictEqual(deletion?.op, 'delete');
  assert.strictEqual(deletion?.heard, null);
});

test('an extra heard word becomes an insertion with no expected index', () => {
  const expected = ['think', 'so'];
  const heard = [w('well'), w('think'), w('so')];
  const aligned = alignWords(expected, heard);
  const insertions = aligned.filter((a) => a.op === 'insert');
  assert.strictEqual(insertions.length, 1);
  assert.strictEqual(insertions[0]?.expectedIndex, null);
  assert.strictEqual(insertions[0]?.heard?.text, 'well');
});

test('three of four words deleted leaves exactly one match and three deletions', () => {
  const expected = ['this', 'is', 'my', 'ship'];
  const heard = [w('ship')];
  const aligned = alignWords(expected, heard).filter((a) => a.expectedIndex !== null);
  assert.strictEqual(aligned.length, 4);
  const deletions = aligned.filter((a) => a.op === 'delete');
  assert.strictEqual(deletions.length, 3);
  const match = aligned.find((a) => a.op === 'match');
  assert.strictEqual(match?.expected, 'ship');
});
