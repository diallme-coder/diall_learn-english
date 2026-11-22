// src/server/handlers/privacy.ts
//
// GET /api/privacy?export=1  -> PrivacyExport, as a download attachment.
// POST /api/privacy (PrivacyRequest body): accept_consent | delete_account.

import type { Result } from '../../lib/types.ts';
import { LIMITS } from '../../lib/types.ts';
import type { ServerDeps } from '../deps.ts';
import { readBodyCapped } from '../../lib/security/audio.ts';
import { parsePrivacyRequest } from '../../lib/security/validate.ts';
import { withGuards, type GuardContext } from './common.ts';
import { errorResponse, jsonResponse } from '../http.ts';

async function parseJsonBody(req: Request): Promise<Result<unknown>> {
  const capped = await readBodyCapped(req, LIMITS.maxJsonBodyBytes);
  if (!capped.ok) return capped;
  try {
    const text = new TextDecoder().decode(capped.value);
    return { ok: true, value: text.length === 0 ? {} : JSON.parse(text) };
  } catch {
    return { ok: false, error: { code: 'bad_request', message: 'Body is not valid JSON.' } };
  }
}

async function handlePrivacy(ctx: GuardContext): Promise<Response> {
  const { req, deps, auth } = ctx;

  if (req.method === 'GET') {
    const url = new URL(req.url);
    if (url.searchParams.get('export') !== '1') {
      return errorResponse({ code: 'bad_request', message: 'GET /api/privacy requires ?export=1.' });
    }
    const exported = await deps.privacy.exportAll(auth);
    if (!exported.ok) return errorResponse(exported.error);
    return jsonResponse(exported.value, 200, { 'content-disposition': 'attachment; filename="parle-to-speak-export.json"' });
  }

  const bodyResult = await parseJsonBody(req);
  if (!bodyResult.ok) return errorResponse(bodyResult.error);

  const parsed = parsePrivacyRequest(bodyResult.value);
  if (!parsed.ok) return errorResponse(parsed.error);

  if (parsed.value.action === 'accept_consent') {
    const result = await deps.privacy.acceptConsent(auth, parsed.value.version, parsed.value.ageBand);
    if (!result.ok) return errorResponse(result.error);
    return jsonResponse({ ok: true });
  }

  const result = await deps.privacy.deleteAccount(auth);
  if (!result.ok) return errorResponse(result.error);
  return jsonResponse({ ok: true });
}

export async function privacyHandler(req: Request, deps: ServerDeps): Promise<Response> {
  return withGuards(req, deps, { route: 'privacy', methods: ['GET', 'POST'] }, handlePrivacy);
}
