import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PROFILE_SETTINGS, fromProfileRow, toSessionRow, fromSessionRow, fromSrsRow,
  fromVocabRow, fromWeakPhonemeRow, fromDrillAttemptRow,
} from './mappers.ts';
import type {
  DrillAttemptRow, ProfileRow, SessionRow, SrsCardRow, VocabularyRow, WeakPhonemeRow,
} from './columns.ts';
import type { SessionSummary } from '../types.ts';

test('fromProfileRow fills defaults for missing settings keys', () => {
  const row: ProfileRow = {
    user_id: 'u1', level: 'B1', native_lang: 'fr', age_band: '18+',
    settings: { captionsOn: false }, updated_at: '2026-11-21T00:00:00Z',
  };
  const profile = fromProfileRow(row, null);
  assert.equal(profile.level, 'B1');
  assert.equal(profile.ageBand, '18+');
  assert.equal(profile.consent, null);
  assert.equal(profile.settings.captionsOn, false);
  assert.equal(profile.settings.playbackRate, DEFAULT_PROFILE_SETTINGS.playbackRate);
});

test('fromProfileRow passes a consent record through unchanged', () => {
  const row: ProfileRow = {
    user_id: 'u1', level: null, native_lang: 'fr', age_band: null,
    settings: {}, updated_at: '2026-11-21T00:00:00Z',
  };
  const consent = { version: '2026-11-21', acceptedAt: 1_700_000_000_000 };
  const profile = fromProfileRow(row, consent);
  assert.deepEqual(profile.consent, consent);
});

test('toSessionRow / fromSessionRow round-trip', () => {
  const summary: SessionSummary = {
    id: 'sess1', kind: 'drill', level: 'A2', scenarioId: null, topicId: null,
    startedAt: 1_700_000_000_000, endedAt: 1_700_000_120_000,
    wordsSpoken: 12, codeSwitchCount: 2, pronunciationAvg: 77.5,
  };
  const row = toSessionRow(summary, 'u1');
  assert.equal(row.user_id, 'u1');
  const back = fromSessionRow(row);
  assert.deepEqual(back, summary);
});

test('fromSrsRow maps null last_reviewed_at through', () => {
  const row: SrsCardRow = {
    user_id: 'u1', item_id: 'item1', ease: 2.5, interval_days: 1,
    repetitions: 0, lapses: 0, due_at: '2026-11-21T00:00:00Z', last_reviewed_at: null,
  };
  const card = fromSrsRow(row);
  assert.equal(card.lastReviewedAt, null);
  assert.equal(card.itemId, 'item1');
});

test('fromVocabRow maps column names to camelCase', () => {
  const row: VocabularyRow = {
    user_id: 'u1', term: 'overwhelmed', french_term: 'débordé', source: 'franglais',
    mastery: 0.3, seen_count: 1, saved: true, last_seen_at: '2026-11-21T00:00:00Z',
  };
  const entry = fromVocabRow(row);
  assert.equal(entry.frenchTerm, 'débordé');
  assert.equal(entry.seenCount, 1);
  assert.equal(entry.saved, true);
});

test('fromWeakPhonemeRow maps column names to camelCase', () => {
  const row: WeakPhonemeRow = {
    user_id: 'u1', trap_id: 'th_as_s', error_count: 2, attempt_count: 5,
    last_seen_at: '2026-11-21T00:00:00Z',
  };
  const phoneme = fromWeakPhonemeRow(row);
  assert.equal(phoneme.trapId, 'th_as_s');
  assert.equal(phoneme.errorCount, 2);
  assert.equal(phoneme.attemptCount, 5);
});

test('fromDrillAttemptRow maps column names to camelCase', () => {
  const row: DrillAttemptRow = {
    id: 'a1', user_id: 'u1', item_id: 'item1', answer: null, correct: true,
    grade: 'good', duration_ms: 1500, input_mode: 'spoken', answered_at: '2026-11-21T00:00:00Z',
  };
  const attempt = fromDrillAttemptRow(row);
  assert.equal(attempt.itemId, 'item1');
  assert.equal(attempt.inputMode, 'spoken');
  assert.equal(attempt.answer, null);
});
