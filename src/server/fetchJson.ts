// src/server/fetchJson.ts
//
// Thin typed fetch wrapper used by every adapter. No SDKs anywhere in this
// codebase (see scripts/check-boundaries.mjs rule 7) — this is the one
// place that owns the plain-`fetch` plumbing: timeout, JSON parsing, and
// mapping upstream failures onto `Result<T, AppError>`. `fetchImpl` is
// injectable so adapter tests never make a real network call.

import type { AppError, Result } from '../lib/types.ts';

export type FetchImpl = typeof fetch;

export interface FetchJsonOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  timeoutMs: number;
  fetchImpl?: FetchImpl;
  /** Retries once on 429 or 5xx, after a short fixed delay. Default: true. */
  retry?: boolean;
}

function upstreamTimeout(message: string): AppError {
  return { code: 'upstream_timeout', message };
}

function upstreamError(message: string): AppError {
  return { code: 'upstream_error', message };
}

async function doFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: FetchImpl,
): Promise<Result<Response, AppError>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    return { ok: true, value: response };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: upstreamTimeout('Upstream request timed out.') };
    }
    return { ok: false, error: upstreamError('Upstream request failed.') };
  } finally {
    clearTimeout(timer);
  }
}

/** Fetches `url`, waits for the body, and parses it as JSON, mapping failures to `AppError`. Never leaks upstream response bodies on error — only a generic message. */
export async function fetchJson<T>(url: string, opts: FetchJsonOptions): Promise<Result<T, AppError>> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const retry = opts.retry ?? true;
  const init: RequestInit = { method: opts.method ?? 'GET', headers: opts.headers, body: opts.body ?? null };

  let result = await doFetch(url, init, opts.timeoutMs, fetchImpl);
  if (result.ok && retry && (result.value.status === 429 || result.value.status >= 500)) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    result = await doFetch(url, init, opts.timeoutMs, fetchImpl);
  }
  if (!result.ok) return result;

  const response = result.value;
  if (!response.ok) {
    return { ok: false, error: upstreamError(`Upstream responded with status ${response.status}.`) };
  }
  try {
    const json = (await response.json()) as T;
    return { ok: true, value: json };
  } catch {
    return { ok: false, error: upstreamError('Upstream returned invalid JSON.') };
  }
}

/** Like `fetchJson`, but returns the raw response bytes (for binary payloads such as TTS audio). */
export async function fetchBytes(url: string, opts: FetchJsonOptions): Promise<Result<Uint8Array, AppError>> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const retry = opts.retry ?? true;
  const init: RequestInit = { method: opts.method ?? 'GET', headers: opts.headers, body: opts.body ?? null };

  let result = await doFetch(url, init, opts.timeoutMs, fetchImpl);
  if (result.ok && retry && (result.value.status === 429 || result.value.status >= 500)) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    result = await doFetch(url, init, opts.timeoutMs, fetchImpl);
  }
  if (!result.ok) return result;

  const response = result.value;
  if (!response.ok) {
    return { ok: false, error: upstreamError(`Upstream responded with status ${response.status}.`) };
  }
  try {
    const buf = await response.arrayBuffer();
    return { ok: true, value: new Uint8Array(buf) };
  } catch {
    return { ok: false, error: upstreamError('Upstream returned an unreadable body.') };
  }
}
