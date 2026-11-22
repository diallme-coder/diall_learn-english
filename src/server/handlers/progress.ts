// src/server/handlers/progress.ts
//
// GET /api/progress?tz=<int, -840..840>  -> ProgressSnapshot
// POST /api/progress  (ClientProgressEvent body)  -> {ok: true}

import type { Result } from '../../lib/types.ts';
import { LIMITS } from '../../lib/types.ts';
import type { ServerDeps } from '../deps.ts';
import { readBodyCapped } from '../../lib/security/audio.ts';
import { parseProgressEvent } from '../../lib/security/validate.ts';
import { getDrill } from '../../lib/drills/index.ts';
import { withGuards, type GuardContext } from './common.ts';
import { errorResponse, jsonResponse } from '../http.ts';

const TZ_MIN = -840;
const TZ_MAX = 840;

function parseTzOffsetMin(raw: string | null): Result<number> {
  if (raw === null) return { ok: true, value: 0 };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < TZ_MIN || n > TZ_MAX) {
    return { ok: false, error: { code: 'bad_request', message: `tz must be an integer in [${TZ_MIN}, ${TZ_MAX}].` } };
  }
  return { ok: true, value: n };
}

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

async function handleProgress(ctx: GuardContext): Promise<Response> {
  const { req, deps, auth } = ctx;

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const tz = parseTzOffsetMin(url.searchParams.get('tz'));
    if (!tz.ok) return errorResponse(tz.error);

    const snapshot = await deps.progress.getSnapshot(auth, { tzOffsetMin: tz.value });
    if (!snapshot.ok) return errorResponse(snapshot.error);
    return jsonResponse(snapshot.value);
  }

  const bodyResult = await parseJsonBody(req);
  if (!bodyResult.ok) return errorResponse(bodyResult.error);

  const parsed = parseProgressEvent(bodyResult.value, {
    drillExists: (id) => getDrill(id) !== undefined,
    clock: deps.clock,
  });
  if (!parsed.ok) return errorResponse(parsed.error);

  const recorded = await deps.progress.record(auth, parsed.value);
  if (!recorded.ok) return errorResponse(recorded.error);
  return jsonResponse({ ok: true });
}

export async function progressHandler(req: Request, deps: ServerDeps): Promise<Response> {
  return withGuards(req, deps, { route: 'progress', methods: ['GET', 'POST'] }, handleProgress);
}
