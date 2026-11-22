import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHADOWING_ITEMS, shadowingFor } from './shadowing.ts';
import { TRAP_IDS, isOneOf } from '../types.ts';
import { isSensitiveWord } from '../pronunciation/index.ts';

test('SHADOWING_ITEMS has at least 10 items', () => {
  assert.ok(SHADOWING_ITEMS.length >= 10, `expected >= 10, got ${SHADOWING_ITEMS.length}`);
});

test('SHADOWING_ITEMS only uses A1, A2 or B1 levels', () => {
  for (const item of SHADOWING_ITEMS) {
    assert.ok(['A1', 'A2', 'B1'].includes(item.level), `${item.id} has level ${item.level}`);
  }
});

test('every item has a non-empty textEn and translationFr', () => {
  for (const item of SHADOWING_ITEMS) {
    assert.ok(item.textEn.length > 0, item.id);
    assert.ok(item.translationFr.length > 0, item.id);
  }
});

test('targetTraps reference only real TrapIds', () => {
  for (const item of SHADOWING_ITEMS) {
    assert.ok(item.targetTraps.length > 0, `${item.id} has no target traps`);
    for (const trap of item.targetTraps) {
      assert.ok(isOneOf(TRAP_IDS, trap), `${item.id} has an invalid trap id: ${trap}`);
    }
  }
});

test('ids are unique', () => {
  const ids = SHADOWING_ITEMS.map((i) => i.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('no sentence contains a sensitive word', () => {
  for (const item of SHADOWING_ITEMS) {
    const words = item.textEn.toLowerCase().match(/[a-z']+/g) ?? [];
    for (const w of words) {
      assert.strictEqual(isSensitiveWord(w), false, `${item.id} contains a sensitive word: ${w}`);
    }
  }
});

test('shadowingFor filters by level', () => {
  const a1 = shadowingFor('A1');
  assert.ok(a1.length > 0);
  for (const item of a1) assert.strictEqual(item.level, 'A1');
});
