import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLikelyHallucination } from './hallucinations.ts';

const DENYLIST_PHRASES = [
  "Sous-titres réalisés par la communauté d'Amara.org",
  "Merci d'avoir regardé",
  "Sous-titrage ST' 501",
  'Thanks for watching',
  'Subtitles by the Amara.org community',
  'Subscribe to my channel',
];

test('every denylist phrase is flagged, including case and punctuation variants', () => {
  for (const phrase of DENYLIST_PHRASES) {
    assert.strictEqual(isLikelyHallucination(phrase), true, `exact: ${phrase}`);
    assert.strictEqual(isLikelyHallucination(phrase.toUpperCase()), true, `uppercase: ${phrase}`);
    assert.strictEqual(isLikelyHallucination(`${phrase}.`), true, `trailing punctuation: ${phrase}`);
    assert.strictEqual(isLikelyHallucination(`  ${phrase}  `), true, `padded whitespace: ${phrase}`);
  }
});

test('repeated ellipsis-only transcripts are flagged', () => {
  assert.strictEqual(isLikelyHallucination('...'), true);
  assert.strictEqual(isLikelyHallucination('. . .'), true);
  assert.strictEqual(isLikelyHallucination('…'), true);
});

test('ordinary speech is never flagged', () => {
  assert.strictEqual(isLikelyHallucination('Thanks for the coffee'), false);
  assert.strictEqual(isLikelyHallucination('I really appreciated watching that with you'), false);
  assert.strictEqual(isLikelyHallucination(''), false);
});
