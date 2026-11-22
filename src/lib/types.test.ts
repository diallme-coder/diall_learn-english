import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CEFR_LEVELS, TRAP_CATEGORIES, TRAP_IDS, TRAP_DEEPLINK, SCENARIO_IDS,
  PRACTICE_MODES, SESSION_KINDS, REVIEW_GRADES, FEEDBACK_TAGS, VOCAB_SOURCES,
  TRANSCRIBE_PURPOSES, CHAT_ROLES, INPUT_MODES, AGE_BANDS, PLAYBACK_RATES,
  TTS_CATALOGS, LIMITS, RATE_LIMITS, SCORE_THRESHOLDS,
  isOneOf, isAllowedAudioMime,
} from './types.ts';

// Every "list" that is a plain readonly array of primitives, checked for
// non-emptiness and uniqueness.
const runtimeArrays: Record<string, readonly (string | number)[]> = {
  CEFR_LEVELS, TRAP_CATEGORIES, TRAP_IDS, SCENARIO_IDS, PRACTICE_MODES,
  SESSION_KINDS, REVIEW_GRADES, FEEDBACK_TAGS, VOCAB_SOURCES,
  TRANSCRIBE_PURPOSES, CHAT_ROLES, INPUT_MODES, AGE_BANDS, PLAYBACK_RATES,
  TTS_CATALOGS, allowedAudioMime: LIMITS.allowedAudioMime,
};

for (const [name, arr] of Object.entries(runtimeArrays)) {
  test(`${name} is non-empty and has unique values`, () => {
    assert.ok(arr.length > 0, `${name} should not be empty`);
    assert.strictEqual(new Set(arr).size, arr.length, `${name} should have unique values`);
  });
}

test('CEFR_LEVELS is in ascending proficiency order', () => {
  assert.deepStrictEqual(CEFR_LEVELS, ['A1', 'A2', 'B1', 'B2', 'C1']);
});

test('isOneOf: positive and negative cases', () => {
  assert.strictEqual(isOneOf(CEFR_LEVELS, 'B1'), true);
  assert.strictEqual(isOneOf(CEFR_LEVELS, 'Z9'), false);
  assert.strictEqual(isOneOf(TRAP_CATEGORIES, 'th'), true);
  assert.strictEqual(isOneOf(TRAP_CATEGORIES, 'nasal'), false);
});

test('isAllowedAudioMime: positive and negative cases', () => {
  assert.strictEqual(isAllowedAudioMime('audio/webm'), true);
  assert.strictEqual(isAllowedAudioMime('audio/wav'), true);
  assert.strictEqual(isAllowedAudioMime('text/plain'), false);
  assert.strictEqual(isAllowedAudioMime(''), false);
});

test('LIMITS.maxAudioBytes matches the 4 MiB budget', () => {
  assert.strictEqual(LIMITS.maxAudioBytes, 4 * 1024 * 1024);
});

test('LIMITS.minRecordingSec is strictly less than maxRecordingSec', () => {
  assert.ok(LIMITS.minRecordingSec < LIMITS.maxRecordingSec);
});

test('LIMITS.maxDebateFeedbackChars is a meaningful standalone cap, not a derived product', () => {
  // The cap is documented as "sum of userTurns; above -> 400". It must be a
  // real ceiling in its own right: positive, and small enough that it is
  // reachable well before maxDebateTurns * maxMessageChars (the absolute
  // upper bound on how much text debate_feedback could ever receive), so
  // the dedicated cap is the one that actually bites in practice.
  assert.ok(LIMITS.maxDebateFeedbackChars > 0);
  const absoluteUpperBound = LIMITS.maxDebateTurns * LIMITS.maxMessageChars;
  assert.ok(
    LIMITS.maxDebateFeedbackChars < absoluteUpperBound,
    'maxDebateFeedbackChars should be a tighter, meaningful cap than maxDebateTurns * maxMessageChars',
  );
});

test('RATE_LIMITS keys are exactly the five rate-limited routes', () => {
  assert.deepStrictEqual(
    Object.keys(RATE_LIMITS).sort(),
    ['chat', 'privacy', 'progress', 'transcribe', 'tts'].sort(),
  );
});

test('RATE_LIMITS: capacity and refillPerMin are positive for every route', () => {
  for (const [route, cfg] of Object.entries(RATE_LIMITS)) {
    assert.ok(cfg.capacity > 0, `${route}.capacity should be positive`);
    assert.ok(cfg.refillPerMin > 0, `${route}.refillPerMin should be positive`);
    if (cfg.dailyBudget !== null) {
      assert.ok(cfg.dailyBudget >= cfg.capacity, `${route}.dailyBudget should be >= capacity`);
    }
  }
});

test('SCORE_THRESHOLDS.warn < SCORE_THRESHOLDS.ok', () => {
  assert.ok(SCORE_THRESHOLDS.warn < SCORE_THRESHOLDS.ok);
});

test('SCORE_THRESHOLDS: confidence and ratio fields are within [0, 1]', () => {
  assert.ok(SCORE_THRESHOLDS.minConfidence >= 0 && SCORE_THRESHOLDS.minConfidence <= 1);
  assert.ok(SCORE_THRESHOLDS.defaultConfidence >= 0 && SCORE_THRESHOLDS.defaultConfidence <= 1);
  assert.ok(SCORE_THRESHOLDS.maxDeletionRatio >= 0 && SCORE_THRESHOLDS.maxDeletionRatio <= 1);
  assert.ok(SCORE_THRESHOLDS.minConfidence <= SCORE_THRESHOLDS.defaultConfidence);
});

test('TRAP_DEEPLINK values are all valid TRAP_CATEGORIES entries', () => {
  for (const category of Object.values(TRAP_DEEPLINK)) {
    assert.ok(
      (TRAP_CATEGORIES as readonly string[]).includes(category),
      `${category} should be one of TRAP_CATEGORIES`,
    );
  }
});

// Grep-style structural check: the plan freezes this file's export surface
// at exactly 115 top-level `export` lines. Recounted after writing the
// final file; if this file is edited the count must be re-verified and
// this number updated to match.
const EXPECTED_EXPORT_LINE_COUNT = 115;

test('types.ts has exactly the frozen number of top-level export lines', () => {
  const typesPath = fileURLToPath(new URL('./types.ts', import.meta.url));
  const source = readFileSync(typesPath, 'utf8');
  const exportLines = source.split('\n').filter((line) => line.startsWith('export'));
  assert.strictEqual(exportLines.length, EXPECTED_EXPORT_LINE_COUNT);
});

test('types.ts has the frozen runtime (value) export count', () => {
  const EXPECTED_RUNTIME_EXPORT_COUNT = 26;
  const url = new URL('./types.ts', import.meta.url);
  return import(url.href).then((mod) => {
    assert.strictEqual(Object.keys(mod).length, EXPECTED_RUNTIME_EXPORT_COUNT);
  });
});
