import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCard, review, isDue, gradeFromResult } from './scheduler.ts';

const T0 = Date.parse('2026-11-22T00:00:00Z');
const DAY_MS = 86_400_000;

test('good x3 from a new card gives intervals 1, 3, 7.5 days', () => {
  let card = newCard('x', T0);
  card = review(card, 'good', T0);
  assert.equal(card.intervalDays, 1);
  card = review(card, 'good', T0 + 1 * DAY_MS);
  assert.equal(card.intervalDays, 3);
  card = review(card, 'good', T0 + 4 * DAY_MS);
  assert.equal(card.intervalDays, 7.5);
});

test('hard on a brand-new card gives 0.5 days, not 0', () => {
  const card = newCard('x', T0);
  const reviewed = review(card, 'hard', T0);
  assert.equal(reviewed.intervalDays, 0.5);
});

test('ease never drops below 1.3 even after many "again" grades', () => {
  let card = newCard('x', T0);
  for (let i = 0; i < 10; i++) {
    card = review(card, 'again', T0 + i * DAY_MS);
    assert.ok(card.ease >= 1.3, `ease=${card.ease} after ${i + 1} agains`);
  }
  assert.equal(card.ease, 1.3);
});

test('again resets repetitions and lapses increment', () => {
  let card = newCard('x', T0);
  card = review(card, 'good', T0);
  card = review(card, 'good', T0 + DAY_MS);
  assert.equal(card.repetitions, 2);
  card = review(card, 'again', T0 + 4 * DAY_MS);
  assert.equal(card.repetitions, 0);
  assert.equal(card.lapses, 1);
});

test('isDue compares dueAt to now', () => {
  const card = newCard('x', T0);
  assert.equal(isDue(card, T0), true);
  assert.equal(isDue(card, T0 - 1), false);
});

test('gradeFromResult maps verdict + duration to a ReviewGrade', () => {
  assert.equal(gradeFromResult({ verdict: 'incorrect', correct: false, matchedTrap: false, normalizedAnswer: '', expected: '', feedbackFr: '' }, 5000), 'again');
  assert.equal(gradeFromResult({ verdict: 'confirm', correct: false, matchedTrap: false, normalizedAnswer: '', expected: '', feedbackFr: '' }, 5000), 'hard');
  assert.equal(gradeFromResult({ verdict: 'correct', correct: true, matchedTrap: false, normalizedAnswer: '', expected: '', feedbackFr: '' }, 20000), 'hard');
  assert.equal(gradeFromResult({ verdict: 'correct', correct: true, matchedTrap: false, normalizedAnswer: '', expected: '', feedbackFr: '' }, 2000), 'easy');
  assert.equal(gradeFromResult({ verdict: 'correct', correct: true, matchedTrap: false, normalizedAnswer: '', expected: '', feedbackFr: '' }, 8000), 'good');
});
