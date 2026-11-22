// src/lib/levels/content.test.ts: cross-cutting content checks (minimum
// counts, non-empty French fields, unique ids, no sensitive words) for the
// scenario/shadowing/idiom/debate/placement catalogs owned by this unit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS } from './scenarios.ts';
import { SHADOWING_ITEMS } from './shadowing.ts';
import { IDIOMS } from './idioms.ts';
import { DEBATE_TOPICS } from './debate.ts';
import { PLACEMENT_QUESTIONS } from './placementQuestions.ts';
import { isSensitiveWord } from '../pronunciation/index.ts';

test('IDIOMS has at least 10 entries, all level C1, ids unique, non-empty French meanings', () => {
  assert.ok(IDIOMS.length >= 10, `expected >= 10, got ${IDIOMS.length}`);
  const ids = IDIOMS.map((i) => i.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const idiom of IDIOMS) {
    assert.strictEqual(idiom.level, 'C1', idiom.id);
    assert.ok(idiom.meaningFr.length > 0, idiom.id);
    assert.ok(idiom.exampleEn.length > 0, idiom.id);
  }
});

test('DEBATE_TOPICS has at least 6 entries, ids unique, idiomIds resolve into IDIOMS', () => {
  assert.ok(DEBATE_TOPICS.length >= 6, `expected >= 6, got ${DEBATE_TOPICS.length}`);
  const topicIds = DEBATE_TOPICS.map((t) => t.id);
  assert.strictEqual(new Set(topicIds).size, topicIds.length);
  const idiomIds = new Set(IDIOMS.map((i) => i.id));
  for (const topic of DEBATE_TOPICS) {
    assert.ok(topic.motionEn.length > 0, topic.id);
    assert.ok(topic.motionFr.length > 0, topic.id);
    assert.ok(topic.idiomIds.length > 0, topic.id);
    for (const idiomId of topic.idiomIds) {
      assert.ok(idiomIds.has(idiomId), `${topic.id} references unknown idiom ${idiomId}`);
    }
  }
});

test('PLACEMENT_QUESTIONS spans A1 through C1 with a mix of choice and speak kinds', () => {
  assert.ok(PLACEMENT_QUESTIONS.length >= 5 && PLACEMENT_QUESTIONS.length <= 6, String(PLACEMENT_QUESTIONS.length));
  const levels = new Set(PLACEMENT_QUESTIONS.map((q) => q.level));
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) {
    assert.ok(levels.has(level), `no placement question at ${level}`);
  }
  const kinds = new Set(PLACEMENT_QUESTIONS.map((q) => q.kind));
  assert.ok(kinds.has('choice'));
  assert.ok(kinds.has('speak'));
  const ids = PLACEMENT_QUESTIONS.map((q) => q.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('every PLACEMENT_QUESTIONS choice question has a valid correctIndex into its options', () => {
  for (const q of PLACEMENT_QUESTIONS) {
    if (q.kind !== 'choice') continue;
    assert.ok(q.correctIndex >= 0 && q.correctIndex < q.options.length, q.id);
  }
});

test('no catalog in this unit uses a sensitive word', () => {
  const texts: string[] = [
    ...SCENARIOS.flatMap((s) => [s.openingLineEn, s.aiRoleEn, ...s.hints.flatMap((t) => t.hints.map((h) => h.en))]),
    ...SHADOWING_ITEMS.map((i) => i.textEn),
    ...IDIOMS.flatMap((i) => [i.en, i.exampleEn]),
    ...DEBATE_TOPICS.map((t) => t.motionEn),
    ...PLACEMENT_QUESTIONS.flatMap((q) => (q.kind === 'choice' ? q.options : [q.referenceText])),
  ];
  for (const text of texts) {
    const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
    for (const w of words) {
      assert.strictEqual(isSensitiveWord(w), false, `"${text}" contains a sensitive word: ${w}`);
    }
  }
});
