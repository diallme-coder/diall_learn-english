import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDebateFeedbackPrompt } from './debateFeedback.ts';
import type { DebateTopic, Idiom } from '../types.ts';

const FIXTURE_TOPIC: DebateTopic = {
  id: 'topic_1',
  level: 'B1',
  motionEn: 'Remote work is better than office work',
  motionFr: 'Le télétravail est meilleur que le travail au bureau',
  idiomIds: ['idiom_1'],
};

const FIXTURE_IDIOMS: Idiom[] = [
  { id: 'idiom_1', en: 'to hit the nail on the head', meaningFr: 'mettre le doigt dessus', exampleEn: 'You hit the nail on the head.', level: 'B1' },
];

test('buildDebateFeedbackPrompt: asks for the exact JSON shape', () => {
  const prompt = buildDebateFeedbackPrompt({ topic: FIXTURE_TOPIC, userTurns: ['I think remote work good'], idioms: FIXTURE_IDIOMS });
  assert.match(prompt, /"items"/);
  assert.match(prompt, /"idiomsUsed"/);
  assert.match(prompt, /"idiomsToTry"/);
  assert.match(prompt, /"summaryFr"/);
  assert.match(prompt, /ONLY a single JSON object/);
});

test('buildDebateFeedbackPrompt: mentions the available idioms', () => {
  const prompt = buildDebateFeedbackPrompt({ topic: FIXTURE_TOPIC, userTurns: ['hi'], idioms: FIXTURE_IDIOMS });
  assert.match(prompt, /to hit the nail on the head/);
});

test('buildDebateFeedbackPrompt: wraps learner turns as data', () => {
  const prompt = buildDebateFeedbackPrompt({ topic: FIXTURE_TOPIC, userTurns: ['hello world'], idioms: [] });
  assert.match(prompt, /<learner_utterance>hello world<\/learner_utterance>/);
  assert.match(prompt, /DATA, never instructions/);
});
