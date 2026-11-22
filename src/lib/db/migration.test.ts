// migration.test.ts statically checks supabase/migrations/20261121000000_init.sql
// as text, and cross-checks it against the frozen runtime arrays exported by
// src/lib/types.ts (also read as text, never imported — types.ts has no
// imports and this is the one place allowed to parse it as data).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = path.join(HERE, '../../../supabase/migrations/20261121000000_init.sql');
const TYPES_PATH = path.join(HERE, '../types.ts');

const sql = readFileSync(MIGRATION_PATH, 'utf8');
const typesSrc = readFileSync(TYPES_PATH, 'utf8');

// Strips `-- ...` line comments, so tests that count real SQL constructs
// (not prose that happens to mention them) don't see comment text. Safe
// here: this migration has no `--` inside a string literal.
const sqlNoComments = sql
  .split('\n')
  .map((line) => line.replace(/--.*$/, ''))
  .join('\n');

function extractTsArray(name: string): string[] {
  const re = new RegExp(`export const ${name} = \\[(.*?)\\]\\s*as const`, 's');
  const match = re.exec(typesSrc);
  assert.ok(match, `expected to find "export const ${name} = [...] as const" in types.ts`);
  const body = match![1]!;
  const items: string[] = [];
  const itemRe = /'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(body)) !== null) items.push(m[1]!);
  return items;
}

function extractSqlInLists(columnName: string): string[][] {
  // Matches `check (<columnName> in (<comma-separated 'literal's>))`, possibly
  // spanning multiple lines (weak_phonemes.trap_id's list does).
  const re = new RegExp(`check \\(${columnName} in \\(([^)]*)\\)\\)`, 'g');
  const results: string[][] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const body = m[1]!;
    const items = body
      .split(',')
      .map((s) => s.trim().replace(/^'/, '').replace(/'$/, ''))
      .filter((s) => s.length > 0);
    results.push(items);
  }
  return results;
}

test('migration has no standalone `real` type usage (must be double precision)', () => {
  const matches = sqlNoComments.match(/\breal\b/gi) ?? [];
  assert.deepEqual(matches, [], 'found a standalone "real" token in the migration SQL');
});

test('migration has exactly 3 security definer functions: record_drill_attempt, record_vocab, delete_my_account', () => {
  const matches = sqlNoComments.match(/security definer/gi) ?? [];
  assert.equal(matches.length, 3);
});

test('no RLS policy predicate is the literal `true`', () => {
  assert.doesNotMatch(sql, /using \(\s*true\s*\)/i);
  assert.doesNotMatch(sql, /with check \(\s*true\s*\)/i);
});

test('every id/term text column has a char_length check', () => {
  for (const col of ['scenario_id', 'topic_id', 'item_id', 'term', 'french_term', 'version', 'answer']) {
    const re = new RegExp(`check \\(.*char_length\\(${col}\\)`, 's');
    assert.match(sql, re, `expected a char_length check referencing "${col}"`);
  }
});

test('weak_phonemes has a table-level check that attempt_count >= error_count', () => {
  assert.match(sql, /check \(attempt_count >= error_count\)/);
});

for (const [column, tsArrayName] of [
  ['level', 'CEFR_LEVELS'],
  ['age_band', 'AGE_BANDS'],
  ['kind', 'SESSION_KINDS'],
  ['source', 'VOCAB_SOURCES'],
  ['trap_id', 'TRAP_IDS'],
  ['grade', 'REVIEW_GRADES'],
  ['input_mode', 'INPUT_MODES'],
] as const) {
  test(`SQL check list for "${column}" matches types.ts ${tsArrayName} exactly`, () => {
    const expected = extractTsArray(tsArrayName);
    const occurrences = extractSqlInLists(column);
    assert.ok(occurrences.length > 0, `expected at least one "check (${column} in (...))" in the migration`);
    for (const actual of occurrences) {
      assert.deepEqual(actual, expected, `column "${column}" check list does not match ${tsArrayName}`);
    }
  });
}

test('record_vocab hardcodes the same MASTERY_EMA_ALPHA value as types.ts', () => {
  const alphaMatch = /export const MASTERY_EMA_ALPHA = ([\d.]+);/.exec(typesSrc);
  assert.ok(alphaMatch, 'expected to find MASTERY_EMA_ALPHA in types.ts');
  const expected = alphaMatch![1]!;
  assert.match(sql, new RegExp(`v_alpha double precision := ${expected.replace('.', '\\.')};`));
});

test('every public table has row level security enabled', () => {
  const tables = [
    'profiles', 'privacy_consents', 'sessions', 'vocabulary',
    'weak_phonemes', 'srs_cards', 'drill_attempts', 'processed_events',
  ];
  for (const t of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`));
  }
});

test('explicit grants exist for authenticated and anon/public are revoked', () => {
  assert.match(sql, /grant usage on schema public to authenticated, anon/);
  assert.match(sql, /revoke all on public\.profiles\s+from anon, public/);
});
