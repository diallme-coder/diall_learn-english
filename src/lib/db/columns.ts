// src/lib/db/columns.ts: table names and DB row types for
// supabase/migrations/20261121000000_init.sql. No imports beyond types.ts.
// This file (plus index.ts and mappers.ts) is the ONLY module F2 may import
// from for knowledge of the database shape.

import type {
  AgeBand, CEFRLevel, EpochMs, InputMode, ReviewGrade, ScenarioId, SessionKind, TrapId, VocabSource,
} from '../types.ts';

export const TABLES = {
  profiles: 'profiles',
  privacyConsents: 'privacy_consents',
  sessions: 'sessions',
  vocabulary: 'vocabulary',
  weakPhonemes: 'weak_phonemes',
  srsCards: 'srs_cards',
  drillAttempts: 'drill_attempts',
  processedEvents: 'processed_events',
} as const;
export type TableName = (typeof TABLES)[keyof typeof TABLES];

// RPCs defined in the migration. F imports only these names when calling
// .rpc() through PostgREST; there is no record_event RPC in this migration.
export const RPC = {
  recordDrillAttempt: 'record_drill_attempt',
  recordVocab: 'record_vocab',
  incrementWeakPhonemes: 'increment_weak_phonemes',
  deleteMyAccount: 'delete_my_account',
} as const;
export type RpcName = (typeof RPC)[keyof typeof RPC];

// Row shapes as returned by PostgREST: timestamps are ISO-8601 strings,
// never EpochMs. mappers.ts converts between the two.

export interface ProfileRow {
  user_id: string;
  level: CEFRLevel | null;
  native_lang: 'fr';
  age_band: AgeBand | null;
  settings: Record<string, unknown>;
  updated_at: string;
}

export interface PrivacyConsentRow {
  user_id: string;
  version: string;
  age_band: AgeBand;
  accepted_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  kind: SessionKind;
  level: CEFRLevel;
  scenario_id: ScenarioId | null;
  topic_id: string | null;
  started_at: string;
  ended_at: string;
  words_spoken: number;
  code_switch_count: number;
  pronunciation_avg: number | null;
}

export interface VocabularyRow {
  user_id: string;
  term: string;
  french_term: string | null;
  source: VocabSource;
  mastery: number;
  seen_count: number;
  saved: boolean;
  last_seen_at: string;
}

export interface WeakPhonemeRow {
  user_id: string;
  trap_id: TrapId;
  error_count: number;
  attempt_count: number;
  last_seen_at: string;
}

export interface SrsCardRow {
  user_id: string;
  item_id: string;
  ease: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  due_at: string;
  last_reviewed_at: string | null;
}

export interface DrillAttemptRow {
  id: string;
  user_id: string;
  item_id: string;
  answer: string | null;
  correct: boolean;
  grade: ReviewGrade;
  duration_ms: number;
  input_mode: InputMode;
  answered_at: string;
}

export interface ProcessedEventRow {
  user_id: string;
  event_id: string;
  processed_at: string;
}

export function isoToEpochMs(iso: string): EpochMs {
  return Date.parse(iso);
}

export function epochMsToIso(ms: EpochMs): string {
  return new Date(ms).toISOString();
}
