import { test } from 'node:test';
import assert from 'node:assert/strict';
import { masteryAfter } from './mastery.ts';

test('masteryAfter(0, true) === 0.3 (the EMA alpha)', () => {
  assert.equal(masteryAfter(0, true), 0.3);
});

test('masteryAfter(1, false) moves down by alpha', () => {
  assert.ok(Math.abs(masteryAfter(1, false) - 0.7) < 1e-9);
});

test('clamped to [0, 1]', () => {
  assert.equal(masteryAfter(0, false), 0);
  assert.equal(masteryAfter(1, true), 1);
});

test('repeated correct answers trend toward 1', () => {
  let m = 0;
  for (let i = 0; i < 50; i++) m = masteryAfter(m, true);
  assert.ok(m > 0.99);
});
