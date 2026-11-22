import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, t, type StringKey } from './strings.ts';

test('every string key has a non-empty fr value', () => {
  const keys = Object.keys(STRINGS) as StringKey[];
  assert.ok(keys.length >= 40, `expected at least 40 keys, got ${keys.length}`);
  for (const key of keys) {
    const variant = STRINGS[key];
    assert.strictEqual(typeof variant.fr, 'string', `${key}.fr should be a string`);
    assert.ok(variant.fr.trim().length > 0, `${key}.fr should be non-empty`);
  }
});

test('t() falls back toward fr when bi/en are missing', () => {
  // ageGateUnder15 has no bi/en in the table (short, fr/en only mixed cases exist too)
  const key: StringKey = 'onboardingWelcome';
  assert.strictEqual(t(key, 'fr'), STRINGS[key].fr);
  assert.strictEqual(t(key, 'bi'), STRINGS[key].bi);
  assert.strictEqual(t(key, 'en'), STRINGS[key].en);
});

test('t() falls back to fr when a key has no bi variant', () => {
  const key: StringKey = 'ageGateUnder15';
  assert.strictEqual(STRINGS[key].bi, undefined);
  assert.strictEqual(t(key, 'bi'), STRINGS[key].fr);
});
