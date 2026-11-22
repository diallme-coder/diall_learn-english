// src/lib/levels/placementQuestions.ts: the placement quiz question pool.
// 6 items spanning A1-C1, mostly 'choice' with two 'speak' items, each tagged
// with the level it targets. The quiz itself (placement.ts) scores whatever
// subset of these — or of a caller-supplied list — it is given; this file
// only owns the content.

import type { PlacementQuestion } from '../types.ts';

export const PLACEMENT_QUESTIONS: readonly PlacementQuestion[] = [
  {
    id: 'placement-a1-greeting',
    level: 'A1',
    kind: 'choice',
    promptEn: 'How do you say "Je m\'appelle Marie" in English?',
    promptFr: 'Comment dit-on « Je m\'appelle Marie » ?',
    options: ['My name is Marie.', 'I call me Marie.', 'I am Marie name.', 'Me Marie.'],
    correctIndex: 0,
  },
  {
    id: 'placement-a2-age',
    level: 'A2',
    kind: 'choice',
    promptEn: 'Choose the correct sentence.',
    promptFr: 'Choisis la phrase correcte.',
    options: ['I have 25 years.', 'I am 25 years old.', 'I have 25 years old.', 'I am 25 year.'],
    correctIndex: 1,
  },
  {
    id: 'placement-a2-speak-live',
    level: 'A2',
    kind: 'speak',
    promptEn: 'Say in English:',
    promptFr: 'Dis en anglais :',
    referenceText: 'Where do you live?',
  },
  {
    id: 'placement-b1-agree',
    level: 'B1',
    kind: 'choice',
    promptEn: 'Which sentence is correct?',
    promptFr: 'Quelle phrase est correcte ?',
    options: ['I am agree with you.', 'I agree with you.', "I'm agreeing with you.", 'I do agree you.'],
    correctIndex: 1,
  },
  {
    id: 'placement-b2-speak-lived',
    level: 'B2',
    kind: 'speak',
    promptEn: 'Say in English:',
    promptFr: 'Dis en anglais :',
    referenceText: "I've been living here for three years.",
  },
  {
    id: 'placement-c1-idiom',
    level: 'C1',
    kind: 'choice',
    promptEn: 'What does "put up with" mean?',
    promptFr: 'Que signifie « put up with » ?',
    options: ['To build something', 'To tolerate something unpleasant', 'To postpone something', 'To agree enthusiastically'],
    correctIndex: 1,
  },
];
