// src/server/adapters/supabaseProgress.ts
//
// Implements `ProgressStore` via PostgREST (`{SUPABASE_URL}/rest/v1/...`)
// with the caller's OWN JWT forwarded as `Authorization` and the anon key
// as `apikey`. RLS (supabase/migrations/20261121000000_init.sql) protects
// every row; there is no service-role key anywhere in this file.
//
// RPC routing for `record`, per src/lib/db's RPC names (there is no
// `record_event` RPC in the migration):
//   - 'drill_attempt'      -> rpc record_drill_attempt (atomic attempt + SRS + idempotency)
//   - 'vocab_result'       -> rpc record_vocab, with a single-item array
//   - 'pronunciation_report' (server-produced only, never from a client) -> rpc increment_weak_phonemes per trap count
//   - 'level_set' | 'settings_updated' | 'session_completed' | 'franglais_saved'
//     -> direct PostgREST PATCH/POST against the relevant table, since no
//        RPC exists for them. 'franglais_saved' has no dedicated table in
//        G's schema, so it is stored as a `vocabulary` row with
//        `source: 'franglais'` (documented deviation from the original
//        plan text, which assumed a table that does not exist).

import type {
  AuthContext,
  EpochMs,
  ProgressEvent,
  ProgressSnapshot,
  ProgressStore,
  Profile,
  Result,
  VocabularyEntry,
} from '../../lib/types.ts';
import { DEFAULT_PROFILE_SETTINGS } from '../../lib/db/index.ts';
import {
  RPC,
  TABLES,
  epochMsToIso,
  fromDrillAttemptRow,
  fromProfileRow,
  fromSessionRow,
  fromSrsRow,
  fromVocabRow,
  fromWeakPhonemeRow,
  toSessionRow,
  type DrillAttemptRow,
  type PrivacyConsentRow,
  type ProfileRow,
  type SessionRow,
  type SrsCardRow,
  type VocabularyRow,
  type WeakPhonemeRow,
} from '../../lib/db/index.ts';
import { computeStreak } from '../../lib/progress/index.ts';
import { fetchJson, type FetchImpl } from '../fetchJson.ts';

const PROGRESS_TIMEOUT_MS = 10_000;
const STREAK_WINDOW_DAYS = 400;

export interface SupabaseProgressOptions {
  supabaseUrl: string;
  anonKey: string;
  fetchImpl?: FetchImpl;
}

export function createSupabaseProgress(opts: SupabaseProgressOptions): ProgressStore {
  const restBase = `${opts.supabaseUrl}/rest/v1`;

  function headers(auth: AuthContext, extra: Record<string, string> = {}): Record<string, string> {
    return {
      authorization: `Bearer ${auth.accessToken}`,
      apikey: opts.anonKey,
      ...extra,
    };
  }

  async function restGet<T>(path: string, auth: AuthContext): Promise<Result<T>> {
    return fetchJson<T>(`${restBase}${path}`, {
      method: 'GET',
      headers: headers(auth),
      timeoutMs: PROGRESS_TIMEOUT_MS,
      fetchImpl: opts.fetchImpl,
    });
  }

  async function restUpsert<T>(
    table: string,
    body: unknown,
    auth: AuthContext,
    onConflict: string,
  ): Promise<Result<T>> {
    return fetchJson<T>(`${restBase}/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: headers(auth, {
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates,return=representation',
      }),
      body: JSON.stringify(body),
      timeoutMs: PROGRESS_TIMEOUT_MS,
      fetchImpl: opts.fetchImpl,
    });
  }

  async function callRpc(name: string, params: Record<string, unknown>, auth: AuthContext): Promise<Result<null>> {
    const result = await fetchJson<unknown>(`${restBase}/rpc/${name}`, {
      method: 'POST',
      headers: headers(auth, { 'content-type': 'application/json' }),
      body: JSON.stringify(params),
      timeoutMs: PROGRESS_TIMEOUT_MS,
      fetchImpl: opts.fetchImpl,
    });
    if (!result.ok) return result;
    return { ok: true, value: null };
  }

  async function getProfile(auth: AuthContext): Promise<Result<Profile>> {
    const [profileResult, consentResult] = await Promise.all([
      restGet<ProfileRow[]>(`/${TABLES.profiles}?user_id=eq.${auth.userId}&select=*`, auth),
      restGet<PrivacyConsentRow[]>(
        `/${TABLES.privacyConsents}?user_id=eq.${auth.userId}&select=*&order=accepted_at.desc&limit=1`,
        auth,
      ),
    ]);
    if (!profileResult.ok) return profileResult;
    if (!consentResult.ok) return consentResult;

    const consentRow = consentResult.value[0];
    const consent = consentRow ? { version: consentRow.version, acceptedAt: Date.parse(consentRow.accepted_at) } : null;

    const profileRow = profileResult.value[0];
    if (!profileRow) {
      return {
        ok: true,
        value: { level: null, nativeLang: 'fr', ageBand: null, consent, settings: DEFAULT_PROFILE_SETTINGS },
      };
    }
    return { ok: true, value: fromProfileRow(profileRow, consent) };
  }

  return {
    async getSnapshot(auth: AuthContext, settings: { tzOffsetMin: number }): Promise<Result<ProgressSnapshot>> {
      const nowMs: EpochMs = Date.now();
      const windowStartIso = epochMsToIso(nowMs - STREAK_WINDOW_DAYS * 24 * 60 * 60 * 1000);

      const [profileResult, vocabResult, weakResult, recentResult, streakResult, srsResult] = await Promise.all([
        getProfile(auth),
        restGet<VocabularyRow[]>(`/${TABLES.vocabulary}?user_id=eq.${auth.userId}&select=*`, auth),
        restGet<WeakPhonemeRow[]>(`/${TABLES.weakPhonemes}?user_id=eq.${auth.userId}&select=*`, auth),
        restGet<SessionRow[]>(
          `/${TABLES.sessions}?user_id=eq.${auth.userId}&select=*&order=ended_at.desc&limit=20`,
          auth,
        ),
        restGet<Array<{ ended_at: string }>>(
          `/${TABLES.sessions}?user_id=eq.${auth.userId}&select=ended_at&ended_at=gte.${windowStartIso}&order=ended_at.desc&limit=1000`,
          auth,
        ),
        restGet<SrsCardRow[]>(`/${TABLES.srsCards}?user_id=eq.${auth.userId}&select=*`, auth),
      ]);

      if (!profileResult.ok) return profileResult;
      if (!vocabResult.ok) return vocabResult;
      if (!weakResult.ok) return weakResult;
      if (!recentResult.ok) return recentResult;
      if (!streakResult.ok) return streakResult;
      if (!srsResult.ok) return srsResult;

      const streakDays = computeStreak(
        streakResult.value.map((r) => Date.parse(r.ended_at)),
        nowMs,
        settings.tzOffsetMin,
      );

      return {
        ok: true,
        value: {
          profile: profileResult.value,
          vocabulary: vocabResult.value.map(fromVocabRow),
          weakPhonemes: weakResult.value.map(fromWeakPhonemeRow),
          recentSessions: recentResult.value.map(fromSessionRow),
          srsCards: srsResult.value.map(fromSrsRow),
          streakDays,
        },
      };
    },

    async record(auth: AuthContext, event: ProgressEvent): Promise<Result<null>> {
      switch (event.type) {
        case 'drill_attempt':
          return callRpc(
            RPC.recordDrillAttempt,
            { p_attempt: event.attempt, p_card: event.card, p_event_id: event.eventId },
            auth,
          );

        case 'vocab_result':
          return callRpc(RPC.recordVocab, { p_items: [{ term: event.term, correct: event.correct }] }, auth);

        case 'pronunciation_report': {
          // One RPC call per trap count; failures are the handler's concern
          // to swallow (it already awaits this under its own 2s timeout).
          for (const count of event.trapCounts) {
            const result = await callRpc(
              RPC.incrementWeakPhonemes,
              { p_trap_id: count.trapId, p_errors: count.errors, p_attempts: count.attempts },
              auth,
            );
            if (!result.ok) return result;
          }
          return { ok: true, value: null };
        }

        case 'level_set': {
          const result = await restUpsert<ProfileRow[]>(
            TABLES.profiles,
            { user_id: auth.userId, level: event.level },
            auth,
            'user_id',
          );
          if (!result.ok) return result;
          return { ok: true, value: null };
        }

        case 'settings_updated': {
          // jsonb `settings` must be read-merge-written: a plain upsert
          // would overwrite the whole column and drop any other setting
          // not included in this partial update.
          const current = await restGet<ProfileRow[]>(
            `/${TABLES.profiles}?user_id=eq.${auth.userId}&select=settings`,
            auth,
          );
          if (!current.ok) return current;
          const existingSettings = current.value[0]?.settings ?? {};
          const merged = { ...DEFAULT_PROFILE_SETTINGS, ...existingSettings, ...event.settings };
          const result = await restUpsert<ProfileRow[]>(
            TABLES.profiles,
            { user_id: auth.userId, settings: merged },
            auth,
            'user_id',
          );
          if (!result.ok) return result;
          return { ok: true, value: null };
        }

        case 'session_completed': {
          const row = toSessionRow(event.session, auth.userId);
          const result = await restUpsert<SessionRow[]>(TABLES.sessions, row, auth, 'id');
          if (!result.ok) return result;
          return { ok: true, value: null };
        }

        case 'franglais_saved': {
          // No franglais-specific table exists in G's schema: stored as a
          // `vocabulary` entry with `source: 'franglais'`. A repeated save
          // of the same term resets seenCount/mastery to this call's
          // values rather than accumulating (acceptable for v1 — see
          // docs/PLAN.md deviations note for this unit).
          const row: VocabularyRow = {
            user_id: auth.userId,
            term: event.englishTerm,
            french_term: event.frenchTerm,
            source: 'franglais',
            mastery: 0,
            seen_count: 1,
            saved: true,
            last_seen_at: epochMsToIso(Date.now()),
          };
          const result = await restUpsert<VocabularyRow[]>(TABLES.vocabulary, row, auth, 'user_id,term');
          if (!result.ok) return result;
          return { ok: true, value: null };
        }

        default: {
          const _exhaustive: never = event;
          return _exhaustive;
        }
      }
    },
  };
}

// Re-exported only so the mapper-focused tests for this adapter (pure
// shape mapping, no network) don't need to duplicate these imports.
export type { DrillAttemptRow };
export { fromDrillAttemptRow };
