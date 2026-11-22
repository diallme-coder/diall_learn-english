// src/server/handlers/transcribe.ts
//
// POST /api/transcribe: multipart `audio` + `purpose` + optional
// `referenceText`. Flow:
//   readBodyCapped (BEFORE formData, per security/audio.ts's documented
//   pattern) -> parseTranscribeFields -> validateAudioInput ->
//   transcriber.transcribe -> silence/hallucination guard (short-circuits
//   everything below) -> analyzeCodeSwitch -> optional scorePronunciation
//   (+ server-side progress.record of the resulting trapCounts, under a
//   2s timeout, failure swallowed) -> TranscribeResponse.

import type { AudioInput, Result, TranscribeResponse } from '../../lib/types.ts';
import { LIMITS, PRIVACY_CONSENT_VERSION, isAllowedAudioMime } from '../../lib/types.ts';
import type { ServerDeps } from '../deps.ts';
import { readBodyCapped, validateAudioInput, isSafeFilename } from '../../lib/security/audio.ts';
import { parseTranscribeFields } from '../../lib/security/validate.ts';
import { analyzeCodeSwitch, isHallucination } from '../../lib/codeswitch/index.ts';
import { scorePronunciation } from '../../lib/pronunciation/index.ts';
import { withGuards, type GuardContext } from './common.ts';
import { errorResponse, jsonResponse } from '../http.ts';

const PROGRESS_RECORD_TIMEOUT_MS = 2000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timed_out'> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('timed_out'), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      () => { clearTimeout(timer); resolve('timed_out'); },
    );
  });
}

async function extractAudio(form: FormData): Promise<Result<AudioInput>> {
  const file = form.get('audio');
  if (!(file instanceof Blob)) {
    return { ok: false, error: { code: 'bad_request', message: 'audio field is required.' } };
  }
  const mimeType = file.type || '';
  if (!isAllowedAudioMime(mimeType)) {
    return { ok: false, error: { code: 'unsupported_media_type', message: 'Audio mime type is not allowed.' } };
  }
  const filename = 'name' in file && typeof (file as File).name === 'string' ? (file as File).name : 'audio';
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { ok: true, value: { bytes, mimeType, filename: isSafeFilename(filename) ? filename : 'audio' } };
}

async function handleTranscribe(ctx: GuardContext): Promise<Response> {
  const { req, deps, auth } = ctx;

  // Mic features require current privacy consent. This is a cheap existence
  // check (not a full getSnapshot/exportAll), and runs before any audio is
  // read or processed. Fails closed: an error from the check itself is
  // treated as "not consented", never as "proceed".
  const consent = await deps.privacy.hasCurrentConsent(auth, PRIVACY_CONSENT_VERSION);
  if (!consent.ok || !consent.value) {
    return errorResponse({ code: 'forbidden', message: 'Privacy consent required.' });
  }

  const capped = await readBodyCapped(req, LIMITS.maxAudioBytes + 64 * 1024);
  if (!capped.ok) return errorResponse(capped.error);

  const form = await new Response(capped.value as unknown as BodyInit, {
    headers: { 'content-type': req.headers.get('content-type') ?? '' },
  }).formData();

  const fields = parseTranscribeFields(form);
  if (!fields.ok) return errorResponse(fields.error);

  const audioResult = await extractAudio(form);
  if (!audioResult.ok) return errorResponse(audioResult.error);
  const audioInput = audioResult.value;

  const validation = validateAudioInput(audioInput);
  if (!validation.ok) return errorResponse(validation.error);

  const transcribed = await deps.transcriber.transcribe(audioInput, { purpose: fields.value.purpose });
  if (!transcribed.ok) return errorResponse(transcribed.error);
  const { noSpeechProb, ...transcript } = transcribed.value;

  if (noSpeechProb > LIMITS.maxNoSpeechProb || isHallucination(transcript.text)) {
    const response: TranscribeResponse = { status: 'no_speech' };
    return jsonResponse(response);
  }

  const codeSwitch = analyzeCodeSwitch(transcript.text);

  let report = null;
  if (fields.value.referenceText) {
    report = scorePronunciation({ referenceText: fields.value.referenceText, transcript });
    await withTimeout(
      deps.progress.record(auth, {
        eventId: crypto.randomUUID(),
        type: 'pronunciation_report',
        trapCounts: report.trapCounts,
      }),
      PROGRESS_RECORD_TIMEOUT_MS,
    );
    // Failure (including a timeout) is intentionally swallowed: the
    // transcribe response must not fail because progress recording is slow.
  }

  const response: TranscribeResponse = { status: 'ok', transcript, codeSwitch, report };
  return jsonResponse(response);
}

export async function transcribeHandler(req: Request, deps: ServerDeps): Promise<Response> {
  return withGuards(req, deps, { route: 'transcribe', methods: ['POST'] }, handleTranscribe);
}
