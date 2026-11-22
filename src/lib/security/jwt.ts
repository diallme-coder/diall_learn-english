// src/lib/security/jwt.ts
//
// Minimal JWT helpers for a quick, pre-network precheck of a bearer token's
// expiry. This does NOT verify the signature — that is the real
// `AuthVerifier` adapter's job in F2 (it calls Supabase). This module only
// lets handlers reject an already-expired or malformed token before paying
// for a network round trip.
//
// Bug class this guards against: JWT `exp` is seconds since the Unix
// epoch, but `EpochMs` (and `Clock.now()`) are milliseconds. Comparing
// `exp > nowMs` directly is always false once `nowMs` is a realistic
// millisecond timestamp, which would reject every token. `exp * 1000` must
// be compared against `nowMs` explicitly — see the test for this file.

export interface JwtPayload {
  exp?: number;
  sub?: string;
  aud?: string;
  [key: string]: unknown;
}

function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const payloadPart = parts[1];
  if (!payloadPart) return null;
  try {
    const json = base64UrlDecode(payloadPart);
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as JwtPayload;
  } catch {
    return null;
  }
}

/** `exp` is SECONDS since the epoch; `nowMs` is milliseconds. */
export function precheckJwtExpiry(token: string, nowMs: number): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return false;
  return payload.exp * 1000 > nowMs;
}
