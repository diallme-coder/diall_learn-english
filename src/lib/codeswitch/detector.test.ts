import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { detectFrench, analyzeCodeSwitch } from './detector.ts';

const fixturesPath = fileURLToPath(new URL('./fixtures/whisper-style.json', import.meta.url));
interface Fixture {
  id: string;
  transcript: string;
  expectedSpanTexts: string[];
  expectedCardCount: number;
  note: string;
}
const fixtures: Fixture[] = JSON.parse(readFileSync(fixturesPath, 'utf8'));

test('fixtures/whisper-style.json holds at least 10 realistic cases', () => {
  assert.ok(fixtures.length >= 10, `expected >= 10 fixtures, got ${fixtures.length}`);
});

for (const fx of fixtures) {
  test(`whisper-style fixture: ${fx.id}`, () => {
    const result = analyzeCodeSwitch(fx.transcript);
    const spanTexts = result.spans.map((s) => s.text).sort();
    assert.deepStrictEqual(spanTexts, [...fx.expectedSpanTexts].sort(), fx.note);
    assert.strictEqual(result.cards.length, fx.expectedCardCount, fx.note);
  });
}

// ───────── Revision-1 regression cases ─────────

test('embouteillage mid-sentence is detected', () => {
  const spans = detectFrench('I was stuck in traffic, an embouteillage really');
  assert.ok(spans.some((s) => s.text === 'embouteillage'));
});

test('pain alone is not flagged (homograph, no adjacent French span)', () => {
  const spans = detectFrench('can you pass the pain please');
  assert.deepStrictEqual(spans, []);
});

test('croissant is never flagged (loanword)', () => {
  const spans = detectFrench('I had a croissant this morning');
  assert.deepStrictEqual(spans, []);
});

test('du coup is detected without a comma', () => {
  const spans = detectFrench('du coup we left early');
  assert.ok(spans.some((s) => s.text === 'du coup' && s.reason === 'phrase'));
});

test('Actuellement/Lyon: the false friend is flagged, the proper noun is not', () => {
  const spans = detectFrench('Actuellement I live in Lyon');
  assert.strictEqual(spans.length, 1);
  assert.strictEqual(spans[0]?.text, 'Actuellement');
});

test("je sais pas: allFrench is true", () => {
  const result = analyzeCodeSwitch('je sais pas');
  assert.strictEqual(result.allFrench, true);
});

test('machin triggers needsClarification with no guessed card', () => {
  const result = analyzeCodeSwitch('there was some machin on the table');
  assert.strictEqual(result.needsClarification, true);
  assert.strictEqual(result.cards.length, 0);
});

// ───────── 'genre' / 'rester' conflict resolution ─────────

test('"music genre" produces no card (ordinary English noun use)', () => {
  const result = analyzeCodeSwitch('what is your favorite music genre');
  assert.strictEqual(result.cards.length, 0);
  assert.deepStrictEqual(result.spans, []);
});

test('"it was genre crazy" produces a filler card (no commas needed)', () => {
  const result = analyzeCodeSwitch('it was genre crazy');
  assert.strictEqual(result.cards.length, 1);
  assert.strictEqual(result.cards[0]?.frenchSpan, 'genre');
});

test("'rester' is NOT flagged as an English homograph, and 'genre' has exactly one classification path", () => {
  // 'rester' must never be suppressed by the homograph adjacency rule: it is
  // a plain false-friend lexicon match, always flagged on its own.
  const spans = detectFrench('I want to rester here a bit longer');
  assert.ok(spans.some((s) => s.text === 'rester' && s.reason === 'lexicon'));

  // 'genre' as an English noun (adjacent to a determiner) is never flagged,
  // and as a filler it is flagged exactly once per occurrence - there is no
  // second code path that could also flag it.
  const englishUse = detectFrench('that is a music genre I really like');
  assert.strictEqual(englishUse.filter((s) => s.text === 'genre').length, 0);
  const fillerUse = detectFrench('genre I went there yesterday');
  assert.strictEqual(fillerUse.filter((s) => s.text === 'genre').length, 1);
});

// ───────── Offsets into the ORIGINAL (un-normalized) string ─────────

test('decomposed-accent input: span offsets slice the ORIGINAL string to the French word', () => {
  // "é" written as "e" + combining acute accent (NFD), not the composed
  // single code point (NFC).
  const decomposed = 'I had a réunion today';
  assert.notStrictEqual(decomposed.normalize('NFC'), decomposed);
  const spans = detectFrench(decomposed);
  assert.strictEqual(spans.length, 1);
  const span = spans[0]!;
  assert.strictEqual(decomposed.slice(span.start, span.end), 'réunion');
});

// ───────── ignoredTerms suppression ─────────

test("ignoredTerms: ['boulangerie'] suppresses that card", () => {
  const withoutIgnore = detectFrench('I went to the boulangerie today');
  assert.ok(withoutIgnore.some((s) => s.text === 'boulangerie'));
  const withIgnore = detectFrench('I went to the boulangerie today', { ignoredTerms: ['boulangerie'] });
  assert.deepStrictEqual(withIgnore, []);
});

// ───────── Performance ─────────

test('a 2000-char input finishes in under 200ms', () => {
  const base = 'This is a long English sentence with an embouteillage and a réunion du coup actuellement je sais pas machin truc genre crazy. ';
  let text = '';
  while (text.length < 2000) text += base;
  text = text.slice(0, 2000);
  const start = performance.now();
  analyzeCodeSwitch(text);
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 200, `took ${elapsed}ms`);
});
