import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultModeFor, scaffoldingFor } from './scaffolding.ts';
import { CEFR_LEVELS } from '../types.ts';

test('A1-A2 default to shadowing, B1-B2 to roleplay, C1 to debate', () => {
  assert.strictEqual(defaultModeFor('A1'), 'shadowing');
  assert.strictEqual(defaultModeFor('A2'), 'shadowing');
  assert.strictEqual(defaultModeFor('B1'), 'roleplay');
  assert.strictEqual(defaultModeFor('B2'), 'roleplay');
  assert.strictEqual(defaultModeFor('C1'), 'debate');
});

test('scaffoldingFor is a pure function: same input, same output, no mutation of CEFR_LEVELS', () => {
  const before = [...CEFR_LEVELS];
  scaffoldingFor('A1');
  scaffoldingFor('C1');
  assert.deepStrictEqual([...CEFR_LEVELS], before);
});

test('A1-A2: shadowing config with French chrome and both playback rates', () => {
  for (const level of ['A1', 'A2'] as const) {
    const config = scaffoldingFor(level);
    assert.strictEqual(config.mode, 'shadowing');
    assert.strictEqual(config.chrome, 'fr');
    assert.ok(config.shadowing);
    assert.strictEqual(config.shadowing!.normalRate, 0.85);
    assert.strictEqual(config.shadowing!.slowRate, 0.6);
    assert.deepStrictEqual([...config.shadowing!.highlightStatuses].sort(), ['error', 'ok', 'unsure', 'warn']);
    assert.strictEqual(config.roleplay, null);
    assert.strictEqual(config.debate, null);
  }
});

test('B1-B2: roleplay config with bilingual chrome and a 3-hint triad', () => {
  for (const level of ['B1', 'B2'] as const) {
    const config = scaffoldingFor(level);
    assert.strictEqual(config.mode, 'roleplay');
    assert.strictEqual(config.chrome, 'bi');
    assert.ok(config.roleplay);
    assert.strictEqual(config.roleplay!.hintTriadSize, 3);
    assert.strictEqual(config.roleplay!.explanationOnTap, true);
    assert.strictEqual(config.shadowing, null);
    assert.strictEqual(config.debate, null);
  }
});

test('C1: debate config with English chrome, idioms enabled, no live side-cards', () => {
  const config = scaffoldingFor('C1');
  assert.strictEqual(config.mode, 'debate');
  assert.strictEqual(config.chrome, 'en');
  assert.ok(config.debate);
  assert.strictEqual(config.debate!.liveSideCards, false);
  assert.strictEqual(config.debate!.idiomsEnabled, true);
  assert.strictEqual(config.shadowing, null);
  assert.strictEqual(config.roleplay, null);
});
