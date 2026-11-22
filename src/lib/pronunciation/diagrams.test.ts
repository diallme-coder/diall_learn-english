import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAP_CATEGORIES } from '../types.ts';
import { MOUTH_DIAGRAMS } from './diagrams.ts';

test('every TRAP_CATEGORY has a diagram with a non-empty altFr and altEn', () => {
  for (const category of TRAP_CATEGORIES) {
    const diagram = MOUTH_DIAGRAMS[category];
    assert.ok(diagram, `missing diagram for ${category}`);
    assert.ok(diagram.altFr.trim().length > 0, `${category}.altFr`);
    assert.ok(diagram.altEn.trim().length > 0, `${category}.altEn`);
  }
});

test('every diagram has a viewBox and at least one non-empty SVG path', () => {
  for (const category of TRAP_CATEGORIES) {
    const diagram = MOUTH_DIAGRAMS[category];
    assert.ok(diagram.viewBox.trim().length > 0, `${category}.viewBox`);
    assert.ok(diagram.paths.length > 0, `${category}.paths`);
    for (const path of diagram.paths) {
      assert.ok(path.trim().length > 0, `${category} has an empty path`);
    }
  }
});
