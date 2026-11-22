// src/client/auth.ts: GoTrue REST client, through plain `fetch` — NOT the @supabase/supabase-js
// SDK (plan guardrail: no SDKs anywhere). This is the ONLY file allowed to reference the
// Supabase auth REST endpoints or build a 'supabase' URL. Every other client module gets an
// access token via the `getAccessToken` function this module exposes, injected in, rather than
// importing this module directly.
import type { EpochMs } from '../lib/types.ts';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: EpochMs; // ms since epoch
  userId: string | null;
}

export interface AuthStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AuthClock {
  now(): EpochMs;
}

export interface AuthClientConfig {
  supabaseUrl: string;
  apiKey: string; // NEXT_PUBLIC_SUPABASE_ANON_KEY, or an sb_publishable_ key
  storage?: AuthStorage;
  clock?: AuthClock;
  fetchFn?: typeof fetch;
}

const STORAGE_KEY = 'pts:auth-session';
/** Refresh this long before `expiresAt`, per plan §H1. */
const REFRESH_SKEW_MS = 60_000;

interface GoTrueTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  user?: { id: string };
}

/** Pure: turns a GoTrue token response into our session shape. Exported for testing. */
export function toAuthSession(json: GoTrueTokenResponse, nowMs: EpochMs): AuthSession {
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: nowMs + json.expires_in * 1000,
    userId: json.user?.id ?? null,
  };
}

/** Pure: true when `session` should be refreshed now, given the skew window. */
export function needsRefresh(session: AuthSession, nowMs: EpochMs): boolean {
  return nowMs >= session.expiresAt - REFRESH_SKEW_MS;
}

export interface AuthClient {
  signInWithOtp(email: string): Promise<{ ok: true } | { ok: false; error: string }>;
  verifyOtp(email: string, token: string): Promise<{ ok: true; session: AuthSession } | { ok: false; error: string }>;
  refreshToken(): Promise<{ ok: true; session: AuthSession } | { ok: false; error: string }>;
  getAccessToken(): Promise<string | null>;
  getSession(): AuthSession | null;
  signOut(): void;
}

export function createAuthClient(config: AuthClientConfig): AuthClient {
  const fetchFn = config.fetchFn ?? fetch;
  const clock = config.clock ?? { now: () => Date.now() };
  const storage = config.storage;

  let session: AuthSession | null = loadSession();

  function loadSession(): AuthSession | null {
    if (storage === undefined) return null;
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
  }

  function saveSession(next: AuthSession | null): void {
    session = next;
    if (storage === undefined) return;
    if (next === null) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async function postJson(path: string, body: unknown): Promise<{ ok: true; json: unknown } | { ok: false; error: string }> {
    const res = await fetchFn(`${config.supabaseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: config.apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, error: `auth_http_${res.status}` };
    return { ok: true, json: await res.json() };
  }

  return {
    async signInWithOtp(email) {
      const result = await postJson('/auth/v1/otp', { email, create_user: true });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    },

    async verifyOtp(email, token) {
      const result = await postJson('/auth/v1/verify', { type: 'email', email, token });
      if (!result.ok) return { ok: false, error: result.error };
      const next = toAuthSession(result.json as GoTrueTokenResponse, clock.now());
      saveSession(next);
      return { ok: true, session: next };
    },

    async refreshToken() {
      if (session === null) return { ok: false, error: 'no_session' };
      const result = await postJson(`/auth/v1/token?grant_type=refresh_token`, {
        refresh_token: session.refreshToken,
      });
      if (!result.ok) return { ok: false, error: result.error };
      const next = toAuthSession(result.json as GoTrueTokenResponse, clock.now());
      saveSession(next);
      return { ok: true, session: next };
    },

    async getAccessToken() {
      if (session === null) return null;
      if (needsRefresh(session, clock.now())) {
        const refreshed = await this.refreshToken();
        return refreshed.ok ? refreshed.session.accessToken : null;
      }
      return session.accessToken;
    },

    getSession() {
      return session;
    },

    signOut() {
      saveSession(null);
    },
  };
}
