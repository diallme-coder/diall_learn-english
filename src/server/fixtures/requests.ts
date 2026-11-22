// src/server/fixtures/requests.ts
//
// Small, dependency-free builders shared by this unit's handler and
// adapter tests: a fake (unsigned) bearer JWT, and real `Request` objects
// (multipart or JSON) built the same way a real client would build them —
// so handler tests exercise the real `readBodyCapped` / `formData()` /
// `JSON.parse` code paths, never a hand-rolled substitute.

function base64UrlEncode(json: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(json));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Builds an unsigned (test-only) JWT-shaped token: 3 base64url parts, a real-looking payload. */
export function fakeJwt(payload: Record<string, unknown>): string {
  const header = base64UrlEncode({ alg: 'HS256', typ: 'JWT' });
  const body = base64UrlEncode(payload);
  return `${header}.${body}.fakesignature`;
}

export function bearerFor(payload: Record<string, unknown>): string {
  return `Bearer ${fakeJwt(payload)}`;
}

export interface MultipartFields {
  purpose: string;
  referenceText?: string;
  audio?: { bytes: Uint8Array; mimeType: string; filename: string };
}

/** Builds a real multipart/form-data POST Request, like the client sends to /api/transcribe. */
export function makeMultipartRequest(
  url: string,
  fields: MultipartFields,
  init: { authorization?: string; origin?: string } = {},
): Request {
  const form = new FormData();
  form.set('purpose', fields.purpose);
  if (fields.referenceText !== undefined) form.set('referenceText', fields.referenceText);
  if (fields.audio) {
    form.set('audio', new Blob([fields.audio.bytes as unknown as BlobPart], { type: fields.audio.mimeType }), fields.audio.filename);
  }
  const headers = new Headers();
  if (init.authorization) headers.set('authorization', init.authorization);
  if (init.origin) headers.set('origin', init.origin);
  return new Request(url, { method: 'POST', headers, body: form });
}

/** Builds a real application/json POST Request. */
export function makeJsonRequest(
  url: string,
  body: unknown,
  init: { authorization?: string; origin?: string; method?: string } = {},
): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (init.authorization) headers.set('authorization', init.authorization);
  if (init.origin) headers.set('origin', init.origin);
  const method = init.method ?? 'POST';
  return new Request(url, { method, headers, body: method === 'GET' ? undefined : JSON.stringify(body) });
}

export function makeGetRequest(url: string, init: { authorization?: string; origin?: string } = {}): Request {
  const headers = new Headers();
  if (init.authorization) headers.set('authorization', init.authorization);
  if (init.origin) headers.set('origin', init.origin);
  return new Request(url, { method: 'GET', headers });
}
