import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FR_LEXICON } from './lexicon.ts';
import { HOMOGRAPHS } from './allowlist.ts';

test('FR_LEXICON has at least 150 entries', () => {
  assert.ok(FR_LEXICON.length >= 150, `expected >= 150, got ${FR_LEXICON.length}`);
});

test('FR_LEXICON has no duplicate fr terms', () => {
  const seen = new Set<string>();
  for (const entry of FR_LEXICON) {
    assert.ok(!seen.has(entry.fr), `duplicate fr term: ${entry.fr}`);
    seen.add(entry.fr);
  }
});

test('every entry has a non-empty fr and en, and a valid kind', () => {
  const kinds = new Set(['word', 'phrase', 'filler', 'false_friend']);
  for (const entry of FR_LEXICON) {
    assert.ok(entry.fr.length > 0, `empty fr for entry: ${JSON.stringify(entry)}`);
    assert.ok(entry.en.length > 0, `empty en for entry: ${JSON.stringify(entry)}`);
    assert.ok(kinds.has(entry.kind), `invalid kind for ${entry.fr}: ${entry.kind}`);
  }
});

test("'genre' resolution: exactly one classification path (lexicon filler), never in allowlist homographs", () => {
  const genreEntries = FR_LEXICON.filter((e) => e.fr === 'genre');
  assert.strictEqual(genreEntries.length, 1, 'genre should appear exactly once in FR_LEXICON');
  assert.strictEqual(genreEntries[0]?.kind, 'filler');
  assert.ok(!HOMOGRAPHS.includes('genre'), 'genre must never be in allowlist.ts HOMOGRAPHS');
});

test("'rester' resolution: present as a false friend, never in the English-homographs allowlist", () => {
  const resterEntries = FR_LEXICON.filter((e) => e.fr === 'rester');
  assert.strictEqual(resterEntries.length, 1, 'rester should appear exactly once in FR_LEXICON');
  assert.strictEqual(resterEntries[0]?.kind, 'false_friend');
  assert.ok(!HOMOGRAPHS.includes('rester'), "'rester' is not an English word and must not be in HOMOGRAPHS");
});

test('the 12 documented homographs are present in FR_LEXICON (so a card can still be built)', () => {
  for (const h of HOMOGRAPHS) {
    assert.ok(FR_LEXICON.some((e) => e.fr === h), `homograph ${h} missing from FR_LEXICON`);
  }
  assert.strictEqual(HOMOGRAPHS.length, 12);
});
