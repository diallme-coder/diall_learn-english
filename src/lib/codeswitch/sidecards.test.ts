import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSideCards, lookupLexiconEntry } from './sidecards.ts';
import { detectFrench } from './detector.ts';
import { LIMITS } from '../types.ts';
import type { DetectedSpan } from '../types.ts';

test('caps at LIMITS.maxSideCardsPerUtterance, highest confidence first, then earliest position', () => {
  const utterance = 'embouteillage boulangerie réunion entretien voiture';
  const spans = detectFrench(utterance);
  assert.ok(spans.length >= 4, 'fixture utterance should produce more spans than the cap');
  const cards = buildSideCards(utterance, spans);
  assert.strictEqual(cards.length, LIMITS.maxSideCardsPerUtterance);
});

test('a span with confidence below 0.7 never becomes a card', () => {
  const lowConfidenceSpan: DetectedSpan = {
    start: 0, end: 10, text: 'quelquchoz', confidence: 0.6, reason: 'morphology',
  };
  const cards = buildSideCards('quelquchoz happened', [lowConfidenceSpan]);
  assert.deepStrictEqual(cards, []);
});

test('a span with no matching lexicon entry never becomes a card', () => {
  const noEntrySpan: DetectedSpan = {
    start: 0, end: 5, text: 'zzzzz', confidence: 0.95, reason: 'diacritic',
  };
  const cards = buildSideCards('zzzzz happened', [noEntrySpan]);
  assert.deepStrictEqual(cards, []);
});

test('lookupLexiconEntry matches regardless of casing/accent form', () => {
  assert.ok(lookupLexiconEntry('EMBOUTEILLAGE'));
  assert.ok(lookupLexiconEntry('Du Coup'));
  assert.strictEqual(lookupLexiconEntry('notarealword'), undefined);
});

test('cards are sorted by position in the utterance, not by confidence', () => {
  const utterance = 'du coup embouteillage';
  const spans = detectFrench(utterance);
  const cards = buildSideCards(utterance, spans);
  assert.deepStrictEqual(cards.map((c) => c.frenchSpan), ['du coup', 'embouteillage']);
});
