import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABLES, RPC, isoToEpochMs, epochMsToIso } from './columns.ts';

test('TABLES names match the migration table names', () => {
  assert.equal(TABLES.profiles, 'profiles');
  assert.equal(TABLES.privacyConsents, 'privacy_consents');
  assert.equal(TABLES.sessions, 'sessions');
  assert.equal(TABLES.vocabulary, 'vocabulary');
  assert.equal(TABLES.weakPhonemes, 'weak_phonemes');
  assert.equal(TABLES.srsCards, 'srs_cards');
  assert.equal(TABLES.drillAttempts, 'drill_attempts');
  assert.equal(TABLES.processedEvents, 'processed_events');
});

test('RPC names match the migration function names', () => {
  assert.equal(RPC.recordDrillAttempt, 'record_drill_attempt');
  assert.equal(RPC.recordVocab, 'record_vocab');
  assert.equal(RPC.incrementWeakPhonemes, 'increment_weak_phonemes');
  assert.equal(RPC.deleteMyAccount, 'delete_my_account');
});

test('isoToEpochMs / epochMsToIso round-trip', () => {
  const ms = 1_700_000_000_000;
  const iso = epochMsToIso(ms);
  assert.equal(isoToEpochMs(iso), ms);
});

test('isoToEpochMs parses a Postgres timestamptz string', () => {
  const ms = isoToEpochMs('2026-11-21T10:00:00.000Z');
  assert.equal(ms, Date.UTC(2026, 10, 21, 10, 0, 0));
});
