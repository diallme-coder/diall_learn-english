import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnswer } from './normalize.ts';

test('lowercases, trims and strips trailing punctuation', () => {
  assert.equal(normalizeAnswer("I'm 25."), "i'm 25");
  assert.equal(normalizeAnswer('  I Agree!  '), 'i agree');
  assert.equal(normalizeAnswer('I agree?'), 'i agree');
});

test('collapses internal whitespace', () => {
  assert.equal(normalizeAnswer('I   am    25'), 'i am 25');
});

test('keeps contractions as-is (no expansion)', () => {
  assert.equal(normalizeAnswer("I've lived here for 3 years"), "i've lived here for 3 years");
  assert.equal(normalizeAnswer("I'm hungry"), "i'm hungry");
});

test('normalizes curly apostrophes to straight ones', () => {
  assert.equal(normalizeAnswer('I’m 25'), "i'm 25");
});
