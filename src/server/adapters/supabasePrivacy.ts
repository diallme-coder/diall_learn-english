// src/server/adapters/supabasePrivacy.ts
//
// Implements `PrivacyStore` via PostgREST + the `delete_my_account` RPC,
// all under the caller's own JWT (no service-role key).

import type { AgeBand, AuthContext, EpochMs, PrivacyExport, Result } from '../../lib/types.ts';
// `PrivacyStore` here is the additive (hasCurrentConsent) version from
// `../../lib/ports/index.ts`, not the frozen base in `../../lib/types.ts`.
import type { PrivacyStore } from '../../lib/ports/index.ts';
import { RPC, TABLES } from '../../lib/db/index.ts';
import {
  fromDrillAttemptRow,
  fromSessionRow,
  fromSrsRow,
  fromVocabRow,
  fromWeakPhonemeRow,
  fromProfileRow,
} from '../../lib/db/index.ts';
import { DEFAULT_PROFILE_SETTINGS } from '../../lib/db/index.ts';
import type {
  DrillAttemptRow,
  PrivacyConsentRow,
  ProfileRow,
  SessionRow,
  SrsCardRow,
  VocabularyRow,
  WeakPhonemeRow,
} from '../../lib/db/index.ts';
import { fetchJson, type FetchImpl } from '../fetchJson.ts';

const PRIVACY_TIMEOUT_MS = 10_000;

export interface SupabasePrivacyOptions {
  supabaseUrl: string;
  anonKey: string;
  fetchImpl?: FetchImpl;
}

export function createSupabasePrivacy(opts: SupabasePrivacyOptions): PrivacyStore {
  const restBase = `${opts.supabaseUrl}/rest/v1`;

  function headers(auth: AuthContext, extra: Record<string, string> = {}): Record<string, string> {
    return { authorization: `Bearer ${auth.accessToken}`, apikey: opts.anonKey, ...extra };
  }

  async function restGet<T>(path: string, auth: AuthContext): Promise<Result<T>> {
    return fetchJson<T>(`${restBase}${path}`, {
      method: 'GET',
      headers: headers(auth),
      timeoutMs: PRIVACY_TIMEOUT_MS,
      fetchImpl: opts.fetchImpl,
    });
  }

  return {
    async acceptConsent(auth: AuthContext, version: string, ageBand: AgeBand): Promise<Result<null>> {
      const result = await fetchJson<PrivacyConsentRow[]>(`${restBase}/${TABLES.privacyConsents}?on_conflict=user_id,version`, {
        method: 'POST',
        headers: headers(auth, {
          'content-type': 'application/json',
          prefer: 'resolution=merge-duplicates,return=representation',
        }),
        body: JSON.stringify({ user_id: auth.userId, version, age_band: ageBand }),
        timeoutMs: PRIVACY_TIMEOUT_MS,
        fetchImpl: opts.fetchImpl,
      });
      if (!result.ok) return result;
      return { ok: true, value: null };
    },

    async exportAll(auth: AuthContext): Promise<Result<PrivacyExport>> {
      const [profileRes, consentsRes, sessionsRes, vocabRes, weakRes, attemptsRes, srsRes] = await Promise.all([
        restGet<ProfileRow[]>(`/${TABLES.profiles}?user_id=eq.${auth.userId}&select=*`, auth),
        restGet<PrivacyConsentRow[]>(`/${TABLES.privacyConsents}?user_id=eq.${auth.userId}&select=*`, auth),
        restGet<SessionRow[]>(`/${TABLES.sessions}?user_id=eq.${auth.userId}&select=*`, auth),
        restGet<VocabularyRow[]>(`/${TABLES.vocabulary}?user_id=eq.${auth.userId}&select=*`, auth),
        restGet<WeakPhonemeRow[]>(`/${TABLES.weakPhonemes}?user_id=eq.${auth.userId}&select=*`, auth),
        restGet<DrillAttemptRow[]>(`/${TABLES.drillAttempts}?user_id=eq.${auth.userId}&select=*`, auth),
        restGet<SrsCardRow[]>(`/${TABLES.srsCards}?user_id=eq.${auth.userId}&select=*`, auth),
      ]);
      if (!profileRes.ok) return profileRes;
      if (!consentsRes.ok) return consentsRes;
      if (!sessionsRes.ok) return sessionsRes;
      if (!vocabRes.ok) return vocabRes;
      if (!weakRes.ok) return weakRes;
      if (!attemptsRes.ok) return attemptsRes;
      if (!srsRes.ok) return srsRes;

      const consents = consentsRes.value.map((c) => ({ version: c.version, acceptedAt: Date.parse(c.accepted_at) }));
      const latestConsent = consents.length > 0 ? consents[consents.length - 1]! : null;
      const profileRow = profileRes.value[0];
      const profile = profileRow
        ? fromProfileRow(profileRow, latestConsent)
        : { level: null, nativeLang: 'fr' as const, ageBand: null, consent: latestConsent, settings: DEFAULT_PROFILE_SETTINGS };

      return {
        ok: true,
        value: {
          exportedAt: Date.now() as EpochMs,
          profile,
          sessions: sessionsRes.value.map(fromSessionRow),
          vocabulary: vocabRes.value.map(fromVocabRow),
          weakPhonemes: weakRes.value.map(fromWeakPhonemeRow),
          drillAttempts: attemptsRes.value.map(fromDrillAttemptRow),
          srsCards: srsRes.value.map(fromSrsRow),
          consents,
        },
      };
    },

    async hasCurrentConsent(auth: AuthContext, version: string): Promise<Result<boolean>> {
      // Cheap existence check: select the smallest possible column, not a
      // full row, and only for the exact (user, version) pair.
      const result = await restGet<PrivacyConsentRow[]>(
        `/${TABLES.privacyConsents}?user_id=eq.${auth.userId}&version=eq.${encodeURIComponent(version)}&select=version`,
        auth,
      );
      if (!result.ok) return result;
      return { ok: true, value: result.value.length > 0 };
    },

    async deleteAccount(auth: AuthContext): Promise<Result<null>> {
      const result = await fetchJson<unknown>(`${restBase}/rpc/${RPC.deleteMyAccount}`, {
        method: 'POST',
        headers: headers(auth, { 'content-type': 'application/json' }),
        body: JSON.stringify({}),
        timeoutMs: PRIVACY_TIMEOUT_MS,
        fetchImpl: opts.fetchImpl,
      });
      if (!result.ok) return result;
      return { ok: true, value: null };
    },
  };
}
