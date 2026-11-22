// src/server/adapters/supabaseAuth.ts
//
// Implements `AuthVerifier` via Supabase's GoTrue REST endpoint:
// `GET /auth/v1/user` with the caller's own bearer token forwarded as
// `Authorization` and the anon/publishable key as `apikey`. No service
// role key anywhere.
//
// Fast path: `precheckJwtExpiry` (src/lib/security/jwt.ts) rejects an
// already-expired token before paying for the network round trip.
// Negative results (a token GoTrue rejects) are cached for 10s, keyed by
// the SHA-256 hash of the token (never the raw token), per the plan's
// documented fix for repeated-401 hammering.

import type { AuthVerifier, EpochMs, Result, AuthContext } from '../../lib/types.ts';
import { precheckJwtExpiry } from '../../lib/security/jwt.ts';
import { fetchJson, type FetchImpl } from '../fetchJson.ts';

const AUTH_TIMEOUT_MS = 10_000;
const NEGATIVE_CACHE_MS = 10_000;

interface GoTrueUserResponse {
  id?: string;
}

export interface SupabaseAuthOptions {
  supabaseUrl: string;
  anonKey: string;
  fetchImpl?: FetchImpl;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function createSupabaseAuth(opts: SupabaseAuthOptions): AuthVerifier {
  const negativeCache = new Map<string, EpochMs>(); // tokenHash -> cached-until

  return {
    async verify(authorizationHeader: string | null, nowMs: EpochMs): Promise<Result<AuthContext>> {
      if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
        return { ok: false, error: { code: 'unauthorized', message: 'Missing bearer token.' } };
      }
      const token = authorizationHeader.slice('Bearer '.length);
      const tokenHash = await sha256Hex(token);

      const cachedUntil = negativeCache.get(tokenHash);
      if (cachedUntil !== undefined) {
        if (cachedUntil > nowMs) {
          return { ok: false, error: { code: 'unauthorized', message: 'Invalid or expired token.' } };
        }
        negativeCache.delete(tokenHash);
      }

      if (!precheckJwtExpiry(token, nowMs)) {
        negativeCache.set(tokenHash, nowMs + NEGATIVE_CACHE_MS);
        return { ok: false, error: { code: 'unauthorized', message: 'Token is expired or malformed.' } };
      }

      const result = await fetchJson<GoTrueUserResponse>(`${opts.supabaseUrl}/auth/v1/user`, {
        method: 'GET',
        headers: { authorization: authorizationHeader, apikey: opts.anonKey },
        timeoutMs: AUTH_TIMEOUT_MS,
        fetchImpl: opts.fetchImpl,
        retry: false,
      });
      if (!result.ok) {
        if (result.error.code === 'upstream_error') {
          negativeCache.set(tokenHash, nowMs + NEGATIVE_CACHE_MS);
          return { ok: false, error: { code: 'unauthorized', message: 'Token was rejected by the auth server.' } };
        }
        return result;
      }
      const userId = result.value.id;
      if (!userId) {
        negativeCache.set(tokenHash, nowMs + NEGATIVE_CACHE_MS);
        return { ok: false, error: { code: 'unauthorized', message: 'Auth server returned no user id.' } };
      }
      return { ok: true, value: { userId, accessToken: token } };
    },
  };
}
