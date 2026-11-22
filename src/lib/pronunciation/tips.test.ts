import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTrap } from './traps.ts';
import { tipFor } from './tips.ts';

test('tipFor returns a non-empty French tip for every trap', () => {
  for (const id of [
    'h_dropped', 'h_inserted', 'th_as_s', 'th_as_f', 'th_as_t', 'dh_as_z', 'dh_as_d',
    'ih_vs_iy', 'uh_vs_uw', 'stress_misplaced', 'weak_forms',
  ] as const) {
    const tip = tipFor(id, 'think');
    assert.ok(tip.trim().length > 0, id);
  }
});

test('tipFor adds a concrete example for a non-sensitive minimal-pair word', () => {
  const tip = tipFor('th_as_s', 'think');
  assert.ok(tip.includes('think'));
  assert.ok(tip.includes('sink'));
});

test('tipFor never reveals the sensitive confusedWith word, even for the sensitive target', () => {
  const trap = getTrap('ih_vs_iy');
  const sensitivePair = trap.minimalPairs.find((p) => p.sensitive);
  assert.ok(sensitivePair);
  const tip = tipFor('ih_vs_iy', sensitivePair.target);
  assert.ok(!tip.toLowerCase().includes(sensitivePair.confusedWith.toLowerCase()));
});

test("tipFor falls back to the generic mouth tip for a word that isn't in any minimal pair", () => {
  const tip = tipFor('th_as_s', 'somethingnotinthecatalog');
  assert.strictEqual(tip, getTrap('th_as_s').mouthTipFr);
});
