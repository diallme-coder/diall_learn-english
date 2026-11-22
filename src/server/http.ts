// src/server/http.ts
//
// Small Response helpers shared by every handler. Every JSON response sent
// by this server (except /api/tts's audio body) carries `Cache-Control:
// no-store`; the one exception (immutable TTS caching) is set by
// handlers/tts.ts itself.

import type { AppError, AppErrorCode } from '../lib/types.ts';

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  payload_too_large: 413,
  unsupported_media_type: 415,
  rate_limited: 429,
  upstream_error: 502,
  upstream_timeout: 504,
  internal: 500,
};

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });
}

export function errorResponse(error: AppError): Response {
  const status = STATUS_BY_CODE[error.code];
  const headers: Record<string, string> = {};
  if (error.retryAfterSec !== undefined) headers['retry-after'] = String(error.retryAfterSec);
  return jsonResponse({ error: { code: error.code, message: error.message } }, status, headers);
}

/**
 * Returns the CORS-relevant headers for a response. Per plan: no ACAO
 * header for a disallowed/foreign origin, ever (this helper returns {} in
 * that case; the origin check itself, run earlier in the guard pipeline,
 * is what actually rejects a foreign request).
 */
export function corsHeaders(origin: string | null, allowedOrigins: readonly string[]): Record<string, string> {
  if (origin === null || !allowedOrigins.includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    vary: 'origin',
  };
}
