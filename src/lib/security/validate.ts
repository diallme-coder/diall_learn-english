// src/lib/security/validate.ts
//
// Hand-written `unknown -> Result<T>` parsers for every API input shape in
// ../types.ts. Lookups that need real data (does a scenario/topic/drill
// exist?) are injected as plain functions by the caller — this file never
// imports from src/lib/levels, src/lib/drills or src/lib/db, so its own
// tests can pass tiny local fixture functions instead.

import type {
  AgeBand,
  ChatMessage,
  ChatRequest,
  ClientProgressEvent,
  Clock,
  EpochMs,
  PrivacyRequest,
  Result,
  TranscribePurpose,
  TtsQuery,
} from '../types.ts';
import {
  AGE_BANDS,
  CEFR_LEVELS,
  CHAT_ROLES,
  INPUT_MODES,
  LIMITS,
  REVIEW_GRADES,
  SCENARIO_IDS,
  SESSION_KINDS,
  TRANSCRIBE_PURPOSES,
  TTS_CATALOGS,
  isOneOf,
} from '../types.ts';

const UUID_SHAPED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

function isUuidShaped(s: unknown): s is string {
  return typeof s === 'string' && s.length > 0 && UUID_SHAPED.test(s);
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function bad(message: string): Result<never> {
  return { ok: false, error: { code: 'bad_request', message } };
}

function forbidden(message: string): Result<never> {
  return { ok: false, error: { code: 'forbidden', message } };
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function isNonNegInt(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0;
}

// ───────────────────────── ChatRequest ─────────────────────────

export interface ParseChatRequestDeps {
  topicExists: (id: string) => boolean;
  scenarioExists: (id: string) => boolean;
}

function parseChatMessages(raw: unknown): Result<ChatMessage[]> {
  if (!Array.isArray(raw)) return bad('messages must be an array.');
  const messages: ChatMessage[] = [];
  for (const m of raw) {
    if (!isRecord(m)) return bad('each message must be an object.');
    const { role, content } = m;
    if (typeof role !== 'string' || !isOneOf(CHAT_ROLES, role)) {
      return bad('message role must be "user" or "assistant".');
    }
    if (typeof content !== 'string') return bad('message content must be a string.');
    if (content.length > LIMITS.maxMessageChars) {
      return bad(`message content exceeds ${LIMITS.maxMessageChars} characters.`);
    }
    messages.push({ role, content });
  }
  // A longer history is truncated to the last N messages, never rejected.
  const truncated = messages.slice(Math.max(0, messages.length - LIMITS.chatHistoryWindow));
  return { ok: true, value: truncated };
}

export function parseChatRequest(raw: unknown, deps: ParseChatRequestDeps): Result<ChatRequest> {
  if (!isRecord(raw)) return bad('request body must be an object.');
  const { action } = raw;

  if (action === 'reply') {
    const { mode, level, scenarioId, topicId, messages } = raw;
    if (typeof level !== 'string' || !isOneOf(CEFR_LEVELS, level)) {
      return bad('level must be a valid CEFR level.');
    }
    const parsedMessages = parseChatMessages(messages);
    if (!parsedMessages.ok) return parsedMessages;

    if (mode === 'roleplay') {
      if (typeof scenarioId !== 'string' || !isOneOf(SCENARIO_IDS, scenarioId)) {
        return bad('scenarioId must be a known scenario id.');
      }
      if (!deps.scenarioExists(scenarioId)) return bad('scenarioId does not exist.');
      return {
        ok: true,
        value: { action: 'reply', mode: 'roleplay', level, scenarioId, messages: parsedMessages.value },
      };
    }
    if (mode === 'debate') {
      if (typeof topicId !== 'string' || topicId.length === 0 || topicId.length > LIMITS.maxIdChars) {
        return bad('topicId must be a non-empty id.');
      }
      if (!deps.topicExists(topicId)) return bad('topicId does not exist.');
      return {
        ok: true,
        value: { action: 'reply', mode: 'debate', level, topicId, messages: parsedMessages.value },
      };
    }
    return bad('mode must be "roleplay" or "debate".');
  }

  if (action === 'debate_feedback') {
    const { level, topicId, userTurns } = raw;
    if (typeof level !== 'string' || !isOneOf(CEFR_LEVELS, level)) {
      return bad('level must be a valid CEFR level.');
    }
    if (typeof topicId !== 'string' || topicId.length === 0 || topicId.length > LIMITS.maxIdChars) {
      return bad('topicId must be a non-empty id.');
    }
    if (!deps.topicExists(topicId)) return bad('topicId does not exist.');
    if (!Array.isArray(userTurns) || !userTurns.every((t): t is string => typeof t === 'string')) {
      return bad('userTurns must be an array of strings.');
    }
    if (userTurns.length > LIMITS.maxDebateTurns) {
      return bad(`userTurns must have at most ${LIMITS.maxDebateTurns} entries.`);
    }
    const totalChars = userTurns.reduce((sum, t) => sum + t.length, 0);
    if (totalChars > LIMITS.maxDebateFeedbackChars) {
      return bad(`userTurns total length exceeds ${LIMITS.maxDebateFeedbackChars} characters.`);
    }
    return { ok: true, value: { action: 'debate_feedback', level, topicId, userTurns } };
  }

  return bad('action must be "reply" or "debate_feedback".');
}

// ───────────────────────── Transcribe fields ─────────────────────────

export interface ParsedTranscribeFields {
  purpose: TranscribePurpose;
  referenceText?: string;
}

/** `form` is anything FormData-shaped: `{ get(name: string): unknown }`. */
export function parseTranscribeFields(form: {
  get(name: string): unknown;
}): Result<ParsedTranscribeFields> {
  const purpose = form.get('purpose');
  if (typeof purpose !== 'string' || !isOneOf(TRANSCRIBE_PURPOSES, purpose)) {
    return bad('purpose must be one of the known transcribe purposes.');
  }
  const rawReferenceText = form.get('referenceText');
  const needsReference = purpose === 'shadowing' || purpose === 'pronunciation' || purpose === 'placement';

  if (rawReferenceText === null || rawReferenceText === undefined || rawReferenceText === '') {
    if (needsReference) return bad('referenceText is required for this purpose.');
    return { ok: true, value: { purpose } };
  }
  if (typeof rawReferenceText !== 'string') return bad('referenceText must be a string.');
  if (rawReferenceText.length > LIMITS.maxReferenceTextChars) {
    return bad(`referenceText exceeds ${LIMITS.maxReferenceTextChars} characters.`);
  }
  return { ok: true, value: { purpose, referenceText: rawReferenceText } };
}

// ───────────────────────── TtsQuery ─────────────────────────

export function parseTtsQuery(raw: unknown): Result<TtsQuery> {
  if (!isRecord(raw)) return bad('query must be an object.');
  const { catalog, id } = raw;
  if (typeof catalog !== 'string' || !isOneOf(TTS_CATALOGS, catalog)) {
    return bad('catalog must be a valid TTS catalog.');
  }
  if (typeof id !== 'string' || id.length === 0 || id.length > LIMITS.maxIdChars || !SAFE_ID.test(id)) {
    return bad('id must be a safe, non-empty id.');
  }
  return { ok: true, value: { catalog, id } };
}

// ───────────────────────── ProgressEvent ─────────────────────────

export interface ParseProgressEventDeps {
  drillExists: (id: string) => boolean;
  clock: Clock;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const FIVE_MIN_MS = 5 * 60 * 1000;

function timestampInWindow(ts: unknown, nowMs: EpochMs): ts is EpochMs {
  return isFiniteNumber(ts) && ts >= nowMs - THIRTY_DAYS_MS && ts <= nowMs + FIVE_MIN_MS;
}

export function parseProgressEvent(
  raw: unknown,
  deps: ParseProgressEventDeps,
): Result<ClientProgressEvent> {
  if (!isRecord(raw)) return bad('event must be an object.');
  const { eventId, type } = raw;
  if (!isUuidShaped(eventId)) return bad('eventId must be a UUID.');
  if (typeof type !== 'string') return bad('type is required.');

  if (type === 'pronunciation_report') {
    return forbidden('pronunciation_report is server-produced only and cannot come from a client.');
  }

  const nowMs = deps.clock.now();

  if (type === 'level_set') {
    const { level } = raw;
    if (typeof level !== 'string' || !isOneOf(CEFR_LEVELS, level)) return bad('level is invalid.');
    return { ok: true, value: { eventId, type, level } };
  }

  if (type === 'settings_updated') {
    const { settings } = raw;
    if (!isRecord(settings)) return bad('settings must be an object.');
    return { ok: true, value: { eventId, type, settings } };
  }

  if (type === 'session_completed') {
    const { session } = raw;
    if (!isRecord(session)) return bad('session must be an object.');
    const { id, kind, level, scenarioId, topicId, startedAt, endedAt, wordsSpoken, codeSwitchCount, pronunciationAvg } = session;
    if (!isUuidShaped(id)) return bad('session.id must be a UUID.');
    if (typeof kind !== 'string' || !isOneOf(SESSION_KINDS, kind)) return bad('session.kind is invalid.');
    if (typeof level !== 'string' || !isOneOf(CEFR_LEVELS, level)) return bad('session.level is invalid.');
    let safeScenarioId: (typeof SCENARIO_IDS)[number] | null = null;
    if (scenarioId !== null && scenarioId !== undefined) {
      if (typeof scenarioId !== 'string' || !isOneOf(SCENARIO_IDS, scenarioId)) {
        return bad('session.scenarioId is invalid.');
      }
      safeScenarioId = scenarioId;
    }
    let safeTopicId: string | null = null;
    if (topicId !== null && topicId !== undefined) {
      if (typeof topicId !== 'string' || topicId.length === 0 || topicId.length > LIMITS.maxIdChars) {
        return bad('session.topicId is invalid.');
      }
      safeTopicId = topicId;
    }
    if (!timestampInWindow(startedAt, nowMs)) return bad('session.startedAt is out of range.');
    if (!timestampInWindow(endedAt, nowMs)) return bad('session.endedAt is out of range.');
    if (endedAt < startedAt) return bad('session.endedAt must be >= session.startedAt.');
    if (!isNonNegInt(wordsSpoken)) return bad('session.wordsSpoken is invalid.');
    if (!isNonNegInt(codeSwitchCount)) return bad('session.codeSwitchCount is invalid.');
    if (pronunciationAvg !== null && !isFiniteNumber(pronunciationAvg)) {
      return bad('session.pronunciationAvg is invalid.');
    }
    return {
      ok: true,
      value: {
        eventId,
        type,
        session: {
          id, kind, level, scenarioId: safeScenarioId, topicId: safeTopicId,
          startedAt, endedAt, wordsSpoken, codeSwitchCount,
          pronunciationAvg: pronunciationAvg ?? null,
        },
      },
    };
  }

  if (type === 'drill_attempt') {
    const { attempt, card } = raw;
    if (!isRecord(attempt) || !isRecord(card)) return bad('attempt and card must be objects.');
    const { id, itemId, answer, correct, grade, durationMs, inputMode, answeredAt } = attempt;
    const { itemId: cardItemId, ease, intervalDays, repetitions, lapses, dueAt, lastReviewedAt } = card;

    if (!isUuidShaped(id)) return bad('attempt.id must be a UUID.');
    if (typeof itemId !== 'string' || itemId.length === 0) return bad('attempt.itemId is invalid.');
    if (!deps.drillExists(itemId)) return bad('attempt.itemId does not exist.');
    if (cardItemId !== itemId) return bad('card.itemId must equal attempt.itemId.');
    if (typeof inputMode !== 'string' || !isOneOf(INPUT_MODES, inputMode)) return bad('attempt.inputMode is invalid.');
    if (answer !== null) {
      if (typeof answer !== 'string' || answer.length > 500) return bad('attempt.answer must be <= 500 chars or null.');
      if (inputMode !== 'typed') return bad('attempt.answer must be null unless inputMode is "typed".');
    }
    if (typeof correct !== 'boolean') return bad('attempt.correct must be a boolean.');
    if (typeof grade !== 'string' || !isOneOf(REVIEW_GRADES, grade)) return bad('attempt.grade is invalid.');
    if (!isFiniteNumber(durationMs) || durationMs < 0 || durationMs > 600000) {
      return bad('attempt.durationMs must be in [0, 600000].');
    }
    if (!isFiniteNumber(answeredAt)) return bad('attempt.answeredAt is invalid.');

    if (!isFiniteNumber(ease) || ease < 1.3 || ease > 5) return bad('card.ease must be in [1.3, 5].');
    if (!isFiniteNumber(intervalDays) || intervalDays < 0 || intervalDays > 180) {
      return bad('card.intervalDays must be in [0, 180].');
    }
    if (!isNonNegInt(repetitions)) return bad('card.repetitions must be a non-negative integer.');
    if (!isNonNegInt(lapses)) return bad('card.lapses must be a non-negative integer.');
    if (!isFiniteNumber(dueAt)) return bad('card.dueAt is invalid.');
    if (lastReviewedAt !== null && !isFiniteNumber(lastReviewedAt)) return bad('card.lastReviewedAt is invalid.');

    return {
      ok: true,
      value: {
        eventId,
        type,
        attempt: { id, itemId, answer, correct, grade, durationMs, inputMode, answeredAt },
        card: { itemId, ease, intervalDays, repetitions, lapses, dueAt, lastReviewedAt: lastReviewedAt ?? null },
      },
    };
  }

  if (type === 'franglais_saved') {
    const { frenchTerm, englishTerm } = raw;
    if (typeof frenchTerm !== 'string' || frenchTerm.length === 0) return bad('frenchTerm is invalid.');
    if (typeof englishTerm !== 'string' || englishTerm.length === 0) return bad('englishTerm is invalid.');
    return { ok: true, value: { eventId, type, frenchTerm, englishTerm } };
  }

  if (type === 'vocab_result') {
    const { term, correct } = raw;
    if (typeof term !== 'string' || term.length === 0) return bad('term is invalid.');
    if (typeof correct !== 'boolean') return bad('correct must be a boolean.');
    return { ok: true, value: { eventId, type, term, correct } };
  }

  return bad('unknown event type.');
}

// ───────────────────────── PrivacyRequest ─────────────────────────

export function parsePrivacyRequest(raw: unknown): Result<PrivacyRequest> {
  if (!isRecord(raw)) return bad('request body must be an object.');
  const { action } = raw;

  if (action === 'accept_consent') {
    const { version, ageBand } = raw;
    if (typeof version !== 'string' || version.length === 0) return bad('version is required.');
    if (typeof ageBand !== 'string' || !isOneOf<AgeBand>(AGE_BANDS, ageBand)) {
      return bad('ageBand must be a valid age band.');
    }
    return { ok: true, value: { action: 'accept_consent', version, ageBand } };
  }

  if (action === 'delete_account') {
    const { confirm } = raw;
    if (confirm !== 'SUPPRIMER') return bad('confirm must be the literal "SUPPRIMER".');
    return { ok: true, value: { action: 'delete_account', confirm: 'SUPPRIMER' } };
  }

  return bad('action must be "accept_consent" or "delete_account".');
}
