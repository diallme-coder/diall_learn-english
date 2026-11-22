import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer } from './checker.ts';
import { getDrill } from './catalog.ts';

const age25 = getDrill('age-25')!;
const agree = getDrill('agree')!;
const livedHere = getDrill('lived-here')!;

test('typed: accepted forms (incl. contractions/digit words) are correct', () => {
  assert.equal(checkAnswer(age25, "I'm 25.", 'typed').verdict, 'correct');
  assert.equal(checkAnswer(age25, 'i am twenty-five', 'typed').verdict, 'correct');
  assert.equal(checkAnswer(agree, 'I Agree.', 'typed').verdict, 'correct');
});

test('typed: the literal trap itself is rejected with matchedTrap', () => {
  const r1 = checkAnswer(age25, 'I have 25 years', 'typed');
  assert.equal(r1.verdict, 'incorrect');
  assert.equal(r1.correct, false);
  assert.equal(r1.matchedTrap, true);

  const r2 = checkAnswer(agree, 'I am agree', 'typed');
  assert.equal(r2.verdict, 'incorrect');
  assert.equal(r2.matchedTrap, true);

  const r3 = checkAnswer(livedHere, 'I live here since 3 years', 'typed');
  assert.equal(r3.verdict, 'incorrect');
  assert.equal(r3.matchedTrap, true);
});

test('typed: an unrelated wrong answer is incorrect without matchedTrap', () => {
  const r = checkAnswer(age25, 'banana', 'typed');
  assert.equal(r.verdict, 'incorrect');
  assert.equal(r.matchedTrap, false);
});

test('spoken: exact accepted-form match is correct', () => {
  const r = checkAnswer(agree, 'I agree', 'spoken');
  assert.equal(r.verdict, 'correct');
  assert.equal(r.correct, true);
});

test('spoken: ASR-style near-miss on the named "lived here" example produces confirm, not incorrect', () => {
  const r = checkAnswer(livedHere, "I've been living here for three years", 'spoken');
  assert.equal(r.verdict, 'confirm');
  assert.equal(r.matchedTrap, false);
  assert.match(r.feedbackFr, /Tu as dit/);
});

test('spoken: saying the literal trap is incorrect, not confirm', () => {
  const r = checkAnswer(livedHere, 'I live here since three years', 'spoken');
  assert.equal(r.verdict, 'incorrect');
  assert.equal(r.matchedTrap, true);
});

test('spoken: a wholly unrelated answer is incorrect', () => {
  const r = checkAnswer(age25, 'I like pizza', 'spoken');
  assert.equal(r.verdict, 'incorrect');
});

test('self_check: always confirm, never claims a score', () => {
  const r = checkAnswer(age25, 'anything the user typed', 'self_check');
  assert.equal(r.verdict, 'confirm');
  assert.equal(r.correct, false);
  assert.match(r.feedbackFr, /I am 25/);
});
