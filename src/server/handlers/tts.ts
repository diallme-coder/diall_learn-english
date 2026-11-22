// src/server/handlers/tts.ts
//
// GET /api/tts?catalog=&id=[&timings=1]. Fixed catalog only (shadowing
// `textEn`, hint `en`, non-sensitive practice words from B's trap catalog).
// Cached by `catalog:id:voice`; `timings=1` additionally runs the
// transcriber (word granularity) on the synthesized audio once and caches
// that result too, for karaoke highlighting.

import type { Result, TtsTimings } from '../../lib/types.ts';
import type { ServerDeps } from '../deps.ts';
import { parseTtsQuery } from '../../lib/security/validate.ts';
import { SHADOWING_ITEMS, getHint } from '../../lib/levels/index.ts';
import { TRAPS, isSensitiveWord } from '../../lib/pronunciation/index.ts';
import { withGuards, type GuardContext } from './common.ts';
import { errorResponse, jsonResponse } from '../http.ts';

function lookupText(catalog: string, id: string): Result<string> {
  if (catalog === 'shadowing') {
    const item = SHADOWING_ITEMS.find((i) => i.id === id);
    if (!item) return { ok: false, error: { code: 'not_found', message: 'Unknown shadowing item id.' } };
    return { ok: true, value: item.textEn };
  }
  if (catalog === 'hint') {
    const hint = getHint(id);
    if (!hint) return { ok: false, error: { code: 'not_found', message: 'Unknown hint id.' } };
    return { ok: true, value: hint.en };
  }
  if (catalog === 'practice_word') {
    if (isSensitiveWord(id)) return { ok: false, error: { code: 'not_found', message: 'Unknown practice word.' } };
    const found = TRAPS.some((t) => t.practiceWords.some((w) => w.toLowerCase() === id.toLowerCase()));
    if (!found) return { ok: false, error: { code: 'not_found', message: 'Unknown practice word.' } };
    return { ok: true, value: id };
  }
  return { ok: false, error: { code: 'not_found', message: 'Unknown TTS catalog.' } };
}

const IMMUTABLE_HEADERS = { 'cache-control': 'public, max-age=31536000, immutable' };

async function handleTts(ctx: GuardContext): Promise<Response> {
  const { req, deps } = ctx;
  const url = new URL(req.url);
  const parsed = parseTtsQuery({ catalog: url.searchParams.get('catalog'), id: url.searchParams.get('id') });
  if (!parsed.ok) return errorResponse(parsed.error);
  const { catalog, id } = parsed.value;
  const wantsTimings = url.searchParams.get('timings') === '1';

  const textResult = lookupText(catalog, id);
  if (!textResult.ok) return errorResponse(textResult.error);
  const text = textResult.value;

  const audioCacheKey = `${catalog}:${id}:${deps.ttsVoice}`;
  let audio = await deps.ttsCache.get(audioCacheKey);
  if (!audio) {
    const synthesized = await deps.tts.synthesize(text, { voice: deps.ttsVoice });
    if (!synthesized.ok) return errorResponse(synthesized.error);
    audio = synthesized.value;
    await deps.ttsCache.set(audioCacheKey, audio);
  }

  if (!wantsTimings) {
    return new Response(audio as unknown as BodyInit, {
      status: 200,
      headers: { 'content-type': 'audio/mpeg', ...IMMUTABLE_HEADERS },
    });
  }

  const timingsCacheKey = `${catalog}:${id}:${deps.ttsVoice}:timings`;
  const cachedTimings = await deps.ttsCache.get(timingsCacheKey);
  if (cachedTimings) {
    const timings = JSON.parse(new TextDecoder().decode(cachedTimings)) as TtsTimings;
    return jsonResponse(timings, 200, IMMUTABLE_HEADERS);
  }

  const transcribed = await deps.transcriber.transcribe(
    { bytes: audio, mimeType: 'audio/mpeg', filename: 'tts.mp3' },
    { purpose: 'shadowing' },
  );
  if (!transcribed.ok) return errorResponse(transcribed.error);

  const timings: TtsTimings = {
    catalog,
    id,
    words: transcribed.value.words,
    durationSec: transcribed.value.durationSec,
  };
  await deps.ttsCache.set(timingsCacheKey, new TextEncoder().encode(JSON.stringify(timings)));
  return jsonResponse(timings, 200, IMMUTABLE_HEADERS);
}

export async function ttsHandler(req: Request, deps: ServerDeps): Promise<Response> {
  return withGuards(req, deps, { route: 'tts', methods: ['GET'] }, handleTts);
}
