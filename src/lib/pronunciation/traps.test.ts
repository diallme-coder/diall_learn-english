import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAP_IDS } from '../types.ts';
import { TRAPS, getTrap } from './traps.ts';
import { isSensitiveWord } from './sensitive.ts';

test('the catalog has exactly the 11 TRAP_IDS, each once', () => {
  assert.strictEqual(TRAPS.length, 11);
  const ids = TRAPS.map((t) => t.id).sort();
  assert.deepStrictEqual(ids, [...TRAP_IDS].sort());
});

test('every trap has at least 3 minimal pairs', () => {
  for (const trap of TRAPS) {
    assert.ok(trap.minimalPairs.length >= 3, `${trap.id} should have >= 3 minimal pairs`);
  }
});

test('every trap has non-empty French fields', () => {
  for (const trap of TRAPS) {
    assert.ok(trap.titleFr.trim().length > 0, `${trap.id}.titleFr`);
    assert.ok(trap.explanationFr.trim().length > 0, `${trap.id}.explanationFr`);
    assert.ok(trap.mouthTipFr.trim().length > 0, `${trap.id}.mouthTipFr`);
    assert.ok(trap.substitution.exampleFr.trim().length > 0, `${trap.id}.substitution.exampleFr`);
  }
});

test('getTrap returns the matching trap and throws on an unknown id', () => {
  const trap = getTrap('th_as_s');
  assert.strictEqual(trap.id, 'th_as_s');
  assert.throws(() => getTrap('not_a_real_id' as never));
});

test('beach/bitch is the only sensitive minimal pair, and only on ih_vs_iy', () => {
  const sensitivePairs = TRAPS.flatMap((t) => t.minimalPairs.filter((p) => p.sensitive).map((p) => ({ trapId: t.id, p })));
  assert.strictEqual(sensitivePairs.length, 1);
  assert.strictEqual(sensitivePairs[0]?.trapId, 'ih_vs_iy');
  assert.strictEqual(sensitivePairs[0]?.p.target, 'beach');
  assert.ok(isSensitiveWord(sensitivePairs[0]?.p.confusedWith ?? ''));
});

test('practiceWords never contain a sensitive word', () => {
  for (const trap of TRAPS) {
    for (const word of trap.practiceWords) {
      assert.ok(!isSensitiveWord(word), `${trap.id}.practiceWords should not contain "${word}"`);
    }
  }
});

test('stress_misplaced and weak_forms are stress_rhythm category (practice-only content)', () => {
  assert.strictEqual(getTrap('stress_misplaced').category, 'stress_rhythm');
  assert.strictEqual(getTrap('weak_forms').category, 'stress_rhythm');
});
