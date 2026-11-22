import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, getScenario, hintsFor, getHint } from './scenarios.ts';
import { SCENARIO_IDS } from '../types.ts';

test('SCENARIOS has exactly the 4 contracted scenario ids', () => {
  assert.deepStrictEqual(
    SCENARIOS.map((s) => s.id).sort(),
    [...SCENARIO_IDS].sort(),
  );
});

test('every scenario has a non-empty French setting and goal, and an English opening line', () => {
  for (const s of SCENARIOS) {
    assert.ok(s.settingFr.length > 0, `${s.id} settingFr`);
    assert.ok(s.userGoalFr.length > 0, `${s.id} userGoalFr`);
    assert.ok(s.openingLineEn.length > 0, `${s.id} openingLineEn`);
    assert.ok(s.levels.length > 0, `${s.id} levels`);
  }
});

test('every scenario has a B1 and a B2 hint tier with exactly 3 hints each', () => {
  for (const s of SCENARIOS) {
    const b1 = s.hints.find((h) => h.level === 'B1');
    const b2 = s.hints.find((h) => h.level === 'B2');
    assert.ok(b1, `${s.id} missing B1 hint tier`);
    assert.ok(b2, `${s.id} missing B2 hint tier`);
    assert.strictEqual(b1!.hints.length, 3, `${s.id} B1 hint count`);
    assert.strictEqual(b2!.hints.length, 3, `${s.id} B2 hint count`);
  }
});

test('hintsFor returns the B2 triple at B2, with a fallback to B1 at other levels', () => {
  const b2 = hintsFor('cafe', 'B2');
  assert.strictEqual(b2?.length, 3);
  const higherAtC1 = hintsFor('cafe', 'C1');
  assert.deepStrictEqual(higherAtC1, b2);
});

test('getScenario returns undefined for an unknown id', () => {
  // @ts-expect-error -- deliberately passing a bad id to check the runtime guard
  assert.strictEqual(getScenario('not-a-scenario'), undefined);
});

test('all hint ids across all scenarios are unique', () => {
  const ids = SCENARIOS.flatMap((s) => s.hints.flatMap((tier) => tier.hints.map((h) => h.id)));
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('getHint finds a hint by its id across scenarios, and misses return undefined', () => {
  const found = getHint('cafe-b1-1');
  assert.strictEqual(found?.en, 'Can I have a flat white, please?');
  assert.strictEqual(getHint('does-not-exist'), undefined);
});

test('every hint has non-empty en, fr and explanationFr', () => {
  for (const s of SCENARIOS) {
    for (const tier of s.hints) {
      for (const hint of tier.hints) {
        assert.ok(hint.en.length > 0, hint.id);
        assert.ok(hint.fr.length > 0, hint.id);
        assert.ok(hint.explanationFr.length > 0, hint.id);
      }
    }
  }
});
