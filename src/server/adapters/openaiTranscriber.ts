// src/server/adapters/openaiTranscriber.ts
//
// Implements the `Transcriber` port via OpenAI's
// `POST /v1/audio/transcriptions` (model `whisper-1`,
// `response_format=verbose_json`, word AND segment timestamp
// granularities). Plain `fetch` only — no SDK.
//
// Per src/lib/prompts/transcribe.ts: NEVER sends a `prompt` built from
// `referenceText`; `getTranscribeLanguageHint` forces `language=en` for
// shadowing|pronunciation|placement and is omitted (auto-detect) for chat.

import type { AudioInput, Lang, Result, Transcriber, TranscribeOptions, Transcript, TranscriptWord } from '../../lib/types.ts';
import { getTranscribeLanguageHint, getTranscribePrompt } from '../../lib/prompts/transcribe.ts';
import { fetchJson, type FetchImpl } from '../fetchJson.ts';

const TRANSCRIBE_TIMEOUT_MS = 30_000;

interface WhisperSegment {
  start: number;
  end: number;
  avg_logprob: number;
  no_speech_prob: number;
}
interface WhisperWord {
  word: string;
  start: number;
  end: number;
}
interface WhisperVerboseJsonResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: WhisperSegment[];
  words?: WhisperWord[];
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** confidence = clamp01(exp(segment.avg_logprob)) * (1 - segment.no_speech_prob), from the segment containing the word's time midpoint. */
export function wordConfidence(word: WhisperWord, segments: readonly WhisperSegment[]): number | undefined {
  const midpoint = (word.start + word.end) / 2;
  const segment =
    segments.find((s) => midpoint >= s.start && midpoint <= s.end) ??
    segments.find((s) => midpoint < s.end) ??
    segments[segments.length - 1];
  if (!segment) return undefined;
  return clamp01(Math.exp(segment.avg_logprob)) * (1 - segment.no_speech_prob);
}

/** Duration-weighted mean of segment.no_speech_prob across all segments; falls back to the single segment's value, or 0 with no segments. */
export function aggregateNoSpeechProb(segments: readonly WhisperSegment[]): number {
  if (segments.length === 0) return 0;
  if (segments.length === 1) return segments[0]!.no_speech_prob;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const s of segments) {
    const weight = Math.max(0, s.end - s.start);
    totalWeight += weight;
    weightedSum += weight * s.no_speech_prob;
  }
  if (totalWeight === 0) return Math.max(...segments.map((s) => s.no_speech_prob));
  return weightedSum / totalWeight;
}

/** `response.language` is a full language name ('english', 'french', ...); maps to our 2-letter Lang, else 'unknown'. */
export function mapWhisperLanguage(language: string | undefined): Lang | 'unknown' {
  if (!language) return 'unknown';
  const normalized = language.trim().toLowerCase();
  if (normalized === 'english') return 'en';
  if (normalized === 'french') return 'fr';
  return 'unknown';
}

/** Pure parser from a (fake-able) Whisper verbose_json body to our Transcript shape, for adapter tests. */
export function parseWhisperVerboseJson(json: WhisperVerboseJsonResponse): Transcript & { noSpeechProb: number } {
  const segments = json.segments ?? [];
  const words: TranscriptWord[] = (json.words ?? []).map((w) => ({
    text: w.word,
    startSec: w.start,
    endSec: w.end,
    confidence: wordConfidence(w, segments),
  }));
  return {
    text: json.text,
    language: mapWhisperLanguage(json.language),
    words,
    durationSec: json.duration ?? (segments.length > 0 ? segments[segments.length - 1]!.end : 0),
    noSpeechProb: aggregateNoSpeechProb(segments),
  };
}

export interface OpenAiTranscriberOptions {
  apiKey: string;
  fetchImpl?: FetchImpl;
  baseUrl?: string;
}

export function createOpenAiTranscriber(opts: OpenAiTranscriberOptions): Transcriber {
  const baseUrl = opts.baseUrl ?? 'https://api.openai.com';

  return {
    async transcribe(
      audio: AudioInput,
      transcribeOpts: TranscribeOptions,
    ): Promise<Result<Transcript & { noSpeechProb: number }>> {
      const form = new FormData();
      // Cast: @types/node's Uint8Array<ArrayBufferLike> vs DOM's BlobPart
      // (ArrayBufferView<ArrayBuffer>) is a known type-only mismatch; the
      // runtime value is a plain Uint8Array and Blob accepts it fine.
      form.set('file', new Blob([audio.bytes as unknown as BlobPart], { type: audio.mimeType }), audio.filename);
      form.set('model', 'whisper-1');
      form.set('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'word');
      form.append('timestamp_granularities[]', 'segment');

      const languageHint = getTranscribeLanguageHint(transcribeOpts.purpose);
      if (languageHint) form.set('language', languageHint);
      const prompt = getTranscribePrompt(transcribeOpts.purpose);
      if (prompt) form.set('prompt', prompt);

      const result = await fetchJson<WhisperVerboseJsonResponse>(`${baseUrl}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${opts.apiKey}` },
        body: form,
        timeoutMs: TRANSCRIBE_TIMEOUT_MS,
        fetchImpl: opts.fetchImpl,
      });
      if (!result.ok) return result;
      return { ok: true, value: parseWhisperVerboseJson(result.value) };
    },
  };
}
