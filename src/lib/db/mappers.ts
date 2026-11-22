// src/lib/db/mappers.ts: DB row <-> domain type (src/lib/types.ts) mappers.

import { SHADOWING_PLAYBACK_RATE } from '../types.ts';
import type {
  ConsentRecord, DrillAttempt, Profile, ProfileSettings, SessionSummary, SrsCard,
  VocabularyEntry, WeakPhoneme,
} from '../types.ts';
import { epochMsToIso, isoToEpochMs } from './columns.ts';
import type {
  DrillAttemptRow, ProfileRow, SessionRow, SrsCardRow, VocabularyRow, WeakPhonemeRow,
} from './columns.ts';

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  captionsOn: true,
  playbackRate: SHADOWING_PLAYBACK_RATE,
  textAnswerMode: false,
  sideCardAutoCollapse: true,
  silenceAnnouncementsWhileRecording: true,
};

function settingsFromJson(json: Record<string, unknown>): ProfileSettings {
  return { ...DEFAULT_PROFILE_SETTINGS, ...(json as Partial<ProfileSettings>) };
}

export function fromProfileRow(row: ProfileRow, consent: ConsentRecord | null): Profile {
  return {
    level: row.level,
    nativeLang: 'fr',
    ageBand: row.age_band,
    consent,
    settings: settingsFromJson(row.settings),
  };
}

export function toSessionRow(session: SessionSummary, userId: string): SessionRow {
  return {
    id: session.id,
    user_id: userId,
    kind: session.kind,
    level: session.level,
    scenario_id: session.scenarioId,
    topic_id: session.topicId,
    started_at: epochMsToIso(session.startedAt),
    ended_at: epochMsToIso(session.endedAt),
    words_spoken: session.wordsSpoken,
    code_switch_count: session.codeSwitchCount,
    pronunciation_avg: session.pronunciationAvg,
  };
}

export function fromSessionRow(row: SessionRow): SessionSummary {
  return {
    id: row.id,
    kind: row.kind,
    level: row.level,
    scenarioId: row.scenario_id,
    topicId: row.topic_id,
    startedAt: isoToEpochMs(row.started_at),
    endedAt: isoToEpochMs(row.ended_at),
    wordsSpoken: row.words_spoken,
    codeSwitchCount: row.code_switch_count,
    pronunciationAvg: row.pronunciation_avg,
  };
}

export function fromSrsRow(row: SrsCardRow): SrsCard {
  return {
    itemId: row.item_id,
    ease: row.ease,
    intervalDays: row.interval_days,
    repetitions: row.repetitions,
    lapses: row.lapses,
    dueAt: isoToEpochMs(row.due_at),
    lastReviewedAt: row.last_reviewed_at === null ? null : isoToEpochMs(row.last_reviewed_at),
  };
}

export function fromVocabRow(row: VocabularyRow): VocabularyEntry {
  return {
    term: row.term,
    frenchTerm: row.french_term,
    source: row.source,
    mastery: row.mastery,
    seenCount: row.seen_count,
    saved: row.saved,
    lastSeenAt: isoToEpochMs(row.last_seen_at),
  };
}

export function fromWeakPhonemeRow(row: WeakPhonemeRow): WeakPhoneme {
  return {
    trapId: row.trap_id,
    errorCount: row.error_count,
    attemptCount: row.attempt_count,
    lastSeenAt: isoToEpochMs(row.last_seen_at),
  };
}

export function fromDrillAttemptRow(row: DrillAttemptRow): DrillAttempt {
  return {
    id: row.id,
    itemId: row.item_id,
    answer: row.answer,
    correct: row.correct,
    grade: row.grade,
    durationMs: row.duration_ms,
    inputMode: row.input_mode,
    answeredAt: isoToEpochMs(row.answered_at),
  };
}
