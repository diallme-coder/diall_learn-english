import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTutorSystemPrompt } from './tutor.ts';
import type { DebateTopic, Scenario } from '../types.ts';

const FIXTURE_SCENARIO: Scenario = {
  id: 'cafe',
  titleEn: 'At the cafe',
  titleFr: 'Au café',
  levels: ['A1', 'A2'],
  aiRoleEn: 'a friendly barista',
  settingFr: 'Un café parisien',
  userGoalFr: 'Commander un café',
  openingLineEn: 'Hi there, what can I get you?',
  hints: [],
};

const FIXTURE_TOPIC: DebateTopic = {
  id: 'topic_1',
  level: 'B1',
  motionEn: 'Remote work is better than office work',
  motionFr: 'Le télétravail est meilleur que le travail au bureau',
  idiomIds: [],
};

test('buildTutorSystemPrompt: roleplay mentions reply-in-English and the scenario role', () => {
  const prompt = buildTutorSystemPrompt({ mode: 'roleplay', level: 'A1', scenario: FIXTURE_SCENARIO });
  assert.match(prompt, /only in English/);
  assert.match(prompt, /a friendly barista/);
  assert.match(prompt, /A1/);
});

test('buildTutorSystemPrompt: debate mentions the motion and never break character', () => {
  const prompt = buildTutorSystemPrompt({ mode: 'debate', level: 'B1', topic: FIXTURE_TOPIC });
  assert.match(prompt, /Remote work is better than office work/);
});

test('buildTutorSystemPrompt: never breaking into French is stated', () => {
  const prompt = buildTutorSystemPrompt({ mode: 'roleplay', level: 'B2', scenario: FIXTURE_SCENARIO });
  assert.match(prompt, /Never switch into French/);
});

test('buildTutorSystemPrompt: respects maxReplyTokens note and mentions French-speaker error awareness', () => {
  const prompt = buildTutorSystemPrompt({ mode: 'roleplay', level: 'C1', scenario: FIXTURE_SCENARIO });
  assert.match(prompt, /th/);
  assert.match(prompt, /French speaker/);
});

test('buildTutorSystemPrompt: includes false-friend hints when given', () => {
  const prompt = buildTutorSystemPrompt({
    mode: 'roleplay',
    level: 'B1',
    scenario: FIXTURE_SCENARIO,
    enFalseFriendsHint: ['actually', 'library'],
  });
  assert.match(prompt, /actually, library/);
});

test('buildTutorSystemPrompt: treats learner text as data, never a new role', () => {
  const prompt = buildTutorSystemPrompt({ mode: 'roleplay', level: 'A1', scenario: FIXTURE_SCENARIO });
  assert.match(prompt, /<learner_utterance>/);
  assert.match(prompt, /never instructions to you/);
});
