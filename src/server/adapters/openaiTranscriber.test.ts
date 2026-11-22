import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateNoSpeechProb,
  clamp01,
  createOpenAiTranscriber,
  mapWhisperLanguage,
  parseWhisperVerboseJson,
  wordConfidence,
} from './openaiTranscriber.ts';
import type { FetchImpl } from '../fetchJson.ts';

test('clamp01: clamps to [0, 1]', () => {
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(0.5), 0.5);
  assert.equal(clamp01(NaN), 0);
});

test('wordConfidence: avg_logprob -0.1 with no_speech 0.1 is ~0.814', () => {
  const segments = [{ start: 0, end: 1, avg_logprob: -0.1, no_speech_prob: 0.1 }];
  const conf = wordConfidence({ word: 'hi', start: 0.1, end: 0.3 }, segments);
  assert.ok(conf !== undefined);
  // clamp01(exp(-0.1)) * (1 - 0.1) = 0.9048... * 0.9 = 0.81439...
  assert.ok(conf! > 0.81 && conf! < 0.82, String(conf));
});

test('aggregateNoSpeechProb: duration-weighted mean across multiple segments', () => {
  const segments = [
    { start: 0, end: 1, avg_logprob: -0.1, no_speech_prob: 0.0 }, // weight 1
    { start: 1, end: 4, avg_logprob: -0.2, no_speech_prob: 0.8 }, // weight 3
  ];
  // (1*0 + 3*0.8) / 4 = 0.6
  assert.ok(Math.abs(aggregateNoSpeechProb(segments) - 0.6) < 1e-9);
});

test('aggregateNoSpeechProb: a single segment returns its own value', () => {
  assert.equal(aggregateNoSpeechProb([{ start: 0, end: 2, avg_logprob: -0.1, no_speech_prob: 0.42 }]), 0.42);
});

test('aggregateNoSpeechProb: no segments returns 0', () => {
  assert.equal(aggregateNoSpeechProb([]), 0);
});

test('mapWhisperLanguage: full language names map to 2-letter codes, else unknown', () => {
  assert.equal(mapWhisperLanguage('english'), 'en');
  assert.equal(mapWhisperLanguage('French'), 'fr');
  assert.equal(mapWhisperLanguage('german'), 'unknown');
  assert.equal(mapWhisperLanguage(undefined), 'unknown');
});

test('parseWhisperVerboseJson: builds a Transcript + noSpeechProb from a fake body', () => {
  const parsed = parseWhisperVerboseJson({
    text: 'hello world',
    language: 'english',
    duration: 1.2,
    segments: [{ start: 0, end: 1.2, avg_logprob: -0.05, no_speech_prob: 0.02 }],
    words: [
      { word: 'hello', start: 0, end: 0.5 },
      { word: 'world', start: 0.6, end: 1.1 },
    ],
  });
  assert.equal(parsed.text, 'hello world');
  assert.equal(parsed.language, 'en');
  assert.equal(parsed.durationSec, 1.2);
  assert.equal(parsed.words.length, 2);
  assert.ok(parsed.words[0]!.confidence! > 0.9);
  assert.equal(parsed.noSpeechProb, 0.02);
});

test('createOpenAiTranscriber: never sends referenceText, forces language=en for shadowing', async () => {
  let capturedForm: FormData | null = null;
  let capturedHeaders: Record<string, string> | undefined;
  const fetchImpl: FetchImpl = (async (_url: string, init?: RequestInit) => {
    capturedForm = init?.body as FormData;
    capturedHeaders = init?.headers as Record<string, string>;
    return new Response(JSON.stringify({ text: 'hi', language: 'english', segments: [], words: [] }), { status: 200 });
  }) as unknown as FetchImpl;

  const transcriber = createOpenAiTranscriber({ apiKey: 'sk-test', fetchImpl });
  const result = await transcriber.transcribe(
    { bytes: new Uint8Array([1, 2, 3]), mimeType: 'audio/webm', filename: 'a.webm' },
    { purpose: 'shadowing' },
  );
  assert.equal(result.ok, true);
  assert.equal(capturedForm!.get('language'), 'en');
  assert.equal(capturedForm!.get('prompt'), null);
  // The key only ever appears in the Authorization header.
  assert.equal(capturedHeaders!.authorization, 'Bearer sk-test');
});

test('createOpenAiTranscriber: an upstream 500 maps to upstream_error', async () => {
  const fetchImpl: FetchImpl = (async () => new Response('boom', { status: 500 })) as unknown as FetchImpl;
  const transcriber = createOpenAiTranscriber({ apiKey: 'sk-test', fetchImpl });
  const result = await transcriber.transcribe(
    { bytes: new Uint8Array([1]), mimeType: 'audio/webm', filename: 'a.webm' },
    { purpose: 'chat' },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'upstream_error');
});
