// src/lib/security/audio.ts
//
// Audio-upload guards. `readBodyCapped` must be called BEFORE
// `req.formData()` — handlers never call `req.formData()` on the original
// request. The usual flow (wired up in F2) is:
//
//   const capped = await readBodyCapped(req, LIMITS.maxAudioBytes + 64 * 1024);
//   if (!capped.ok) return <error response>;
//   const form = await new Response(capped.value, {
//     headers: { 'content-type': req.headers.get('content-type') ?? '' },
//   }).formData();
//
// This guarantees the body is never read past the cap, even when a client
// sends a `Content-Length` header that understates the real body size.

import type { AudioInput, Result } from '../types.ts';
import { isAllowedAudioMime, LIMITS } from '../types.ts';

const SAFE_FILENAME = /^[A-Za-z0-9._-]{1,255}$/;

export function isSafeFilename(name: string): boolean {
  return SAFE_FILENAME.test(name) && !name.includes('..');
}

export function validateAudioInput(input: AudioInput): Result<null> {
  if (!isAllowedAudioMime(input.mimeType)) {
    return { ok: false, error: { code: 'unsupported_media_type', message: 'Audio mime type is not allowed.' } };
  }
  if (input.bytes.byteLength > LIMITS.maxAudioBytes) {
    return { ok: false, error: { code: 'payload_too_large', message: 'Audio exceeds the maximum allowed size.' } };
  }
  if (!isSafeFilename(input.filename)) {
    return { ok: false, error: { code: 'bad_request', message: 'Filename is not safe.' } };
  }
  return { ok: true, value: null };
}

/**
 * Reads a `Request` body up to `maxBytes`, aborting if either the declared
 * `Content-Length` or the actual streamed byte count exceeds the cap. The
 * stream is read incrementally so a lying `Content-Length` cannot be used
 * to smuggle an oversized body past the check.
 */
export async function readBodyCapped(req: Request, maxBytes: number): Promise<Result<Uint8Array>> {
  const declaredLength = req.headers.get('content-length');
  if (declaredLength !== null) {
    const declared = Number(declaredLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      return { ok: false, error: { code: 'payload_too_large', message: 'Declared content-length exceeds the cap.' } };
    }
  }

  const body = req.body;
  if (!body) {
    return { ok: true, value: new Uint8Array(0) };
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, error: { code: 'payload_too_large', message: 'Body exceeded the size cap while streaming.' } };
      }
      chunks.push(value);
    }
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, value: out };
}
