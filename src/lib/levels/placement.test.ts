import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePlacement, selfSelectPlacement, PLACEMENT_TRANSITIONS } from './placement.ts';
import { PLACEMENT_QUESTIONS } from './placementQuestions.ts';
import type { PlacementAnswer, PlacementQuestion } from '../types.ts';

const choiceQ = (id: string, level: PlacementQuestion['level'], correctIndex = 0): PlacementQuestion => ({
  id, level, kind: 'choice', promptEn: 'p', options: ['a', 'b'], correctIndex,
});
const speakQ = (id: string, level: PlacementQuestion['level']): PlacementQuestion => ({
  id, level, kind: 'speak', promptEn: 'p', referenceText: 'r',
});

test('PLACEMENT_TRANSITIONS is a complete staircase with A1 floor and C1 ceiling', () => {
  assert.strictEqual(PLACEMENT_TRANSITIONS.A1.onIncorrect, 'A1');
  assert.strictEqual(PLACEMENT_TRANSITIONS.C1.onCorrect, 'C1');
  assert.strictEqual(PLACEMENT_TRANSITIONS.A2.onCorrect, 'B1');
  assert.strictEqual(PLACEMENT_TRANSITIONS.B1.onIncorrect, 'A2');
});

test('all correct across the real question pool reaches C1', () => {
  const answers: PlacementAnswer[] = PLACEMENT_QUESTIONS.map((q) =>
    q.kind === 'choice'
      ? { questionId: q.id, kind: 'choice', choiceIndex: q.correctIndex }
      : { questionId: q.id, kind: 'speak', spokenScore: 1 },
  );
  const result = scorePlacement(answers, PLACEMENT_QUESTIONS);
  assert.strictEqual(result.level, 'C1');
  assert.strictEqual(result.method, 'quiz');
});

test('all wrong across the real question pool falls back to A1', () => {
  const answers: PlacementAnswer[] = PLACEMENT_QUESTIONS.map((q) =>
    q.kind === 'choice'
      ? { questionId: q.id, kind: 'choice', choiceIndex: (q.correctIndex + 1) % q.options.length }
      : { questionId: q.id, kind: 'speak', spokenScore: 0 },
  );
  const result = scorePlacement(answers, PLACEMENT_QUESTIONS);
  assert.strictEqual(result.level, 'A1');
});

test('all wrong even at A2-only questions still falls back to A1', () => {
  const questions = [choiceQ('q-a2-1', 'A2'), choiceQ('q-a2-2', 'A2')];
  const answers: PlacementAnswer[] = [
    { questionId: 'q-a2-1', kind: 'choice', choiceIndex: 1 },
    { questionId: 'q-a2-2', kind: 'choice', choiceIndex: 1 },
  ];
  const result = scorePlacement(answers, questions);
  assert.strictEqual(result.level, 'A1');
});

test('all "dont_know" answers fall back to A1 with low confidence', () => {
  const questions = [choiceQ('q1', 'A2'), choiceQ('q2', 'B1'), speakQ('q3', 'B2')];
  const answers: PlacementAnswer[] = questions.map((q) => ({ questionId: q.id, kind: 'dont_know' }));
  const result = scorePlacement(answers, questions);
  assert.strictEqual(result.level, 'A1');
  assert.strictEqual(result.confidence, 'low');
  for (const level of Object.keys(result.accuracyByLevel) as (keyof typeof result.accuracyByLevel)[]) {
    assert.strictEqual(result.accuracyByLevel[level], null);
  }
});

test('"dont_know" counts as incorrect for the level chain but is excluded from the accuracy tally', () => {
  const questions = [choiceQ('q1', 'A1'), choiceQ('q2', 'A2')];
  const answers: PlacementAnswer[] = [
    { questionId: 'q1', kind: 'choice', choiceIndex: 0 }, // correct
    { questionId: 'q2', kind: 'dont_know' },
  ];
  const result = scorePlacement(answers, questions);
  assert.strictEqual(result.accuracyByLevel.A1, 1);
  assert.strictEqual(result.accuracyByLevel.A2, null); // dont_know never enters the tally
  assert.strictEqual(result.level, 'A1'); // A2 could not be confirmed, so it does not count as passed
});

test('speak answers are weighted low relative to choice answers', () => {
  // One wrong speak answer at B1 should not outweigh a correct choice answer
  // at the same level when both are present.
  const questions = [choiceQ('q1', 'B1', 0), speakQ('q2', 'B1')];
  const answers: PlacementAnswer[] = [
    { questionId: 'q1', kind: 'choice', choiceIndex: 0 }, // correct, weight 1
    { questionId: 'q2', kind: 'speak', spokenScore: 0 }, // wrong, weight 0.5
  ];
  const result = scorePlacement(answers, questions);
  // weighted accuracy = 1 / 1.5 = 0.667, still >= 0.6
  assert.ok(result.accuracyByLevel.B1! >= 0.6);
  assert.strictEqual(result.level, 'B1');
});

test('speakAllowed-style callers never need to pass speak questions: self_select works standalone', () => {
  const result = selfSelectPlacement('B1');
  assert.deepStrictEqual(result, {
    level: 'B1',
    accuracyByLevel: { A1: null, A2: null, B1: null, B2: null, C1: null },
    confidence: 'low',
    method: 'self_select',
  });
});

test('confidence "high" IS reachable with a realistic small quiz (one question per level)', () => {
  // A1 and A2 correct, B1 wrong: decided level is A2, with a confirmed miss
  // at the level above (B1) -- exactly the "achievable" shape the review
  // asked for: no level needs 2 questions to reach 'high'.
  const questions = [choiceQ('q1', 'A1', 0), choiceQ('q2', 'A2', 0), choiceQ('q3', 'B1', 0)];
  const answers: PlacementAnswer[] = [
    { questionId: 'q1', kind: 'choice', choiceIndex: 0 },
    { questionId: 'q2', kind: 'choice', choiceIndex: 0 },
    { questionId: 'q3', kind: 'choice', choiceIndex: 1 }, // wrong
  ];
  const result = scorePlacement(answers, questions);
  assert.strictEqual(result.level, 'A2');
  assert.strictEqual(result.confidence, 'high');
});

test('confidence "high" at the C1 ceiling needs two confirming C1 answers (no level above to disconfirm)', () => {
  const questions = [choiceQ('q1', 'C1', 0), choiceQ('q2', 'C1', 0)];
  const oneAnswer: PlacementAnswer[] = [{ questionId: 'q1', kind: 'choice', choiceIndex: 0 }];
  const twoAnswers: PlacementAnswer[] = [
    { questionId: 'q1', kind: 'choice', choiceIndex: 0 },
    { questionId: 'q2', kind: 'choice', choiceIndex: 0 },
  ];
  assert.strictEqual(scorePlacement(oneAnswer, questions).confidence, 'medium');
  assert.strictEqual(scorePlacement(twoAnswers, questions).confidence, 'high');
});

test('an answer referencing an unknown questionId is ignored rather than throwing', () => {
  const questions = [choiceQ('q1', 'A1', 0)];
  const answers: PlacementAnswer[] = [{ questionId: 'ghost', kind: 'choice', choiceIndex: 0 }];
  assert.doesNotThrow(() => scorePlacement(answers, questions));
  const result = scorePlacement(answers, questions);
  assert.strictEqual(result.level, 'A1');
});
