// src/server/adapters/openaiTts.ts
//
// Implements `SpeechSynthesizer` via OpenAI's TTS endpoint
// (`POST /v1/audio/speech`, model from ServerDeps/env, voice from opts,
// `response_format: 'mp3'`) -> raw audio bytes. Plain `fetch` only.

import type { Result, SpeechSynthesizer } from '../../lib/types.ts';
import { fetchBytes, type FetchImpl } from '../fetchJson.ts';

const TTS_TIMEOUT_MS = 15_000;

export interface OpenAiTtsOptions {
  apiKey: string;
  model: string;
  fetchImpl?: FetchImpl;
  baseUrl?: string;
}

export function createOpenAiTts(opts: OpenAiTtsOptions): SpeechSynthesizer {
  const baseUrl = opts.baseUrl ?? 'https://api.openai.com';

  return {
    async synthesize(text: string, synthOpts: { voice: string }): Promise<Result<Uint8Array>> {
      return fetchBytes(`${baseUrl}/v1/audio/speech`, {
        method: 'POST',
        headers: { authorization: `Bearer ${opts.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: opts.model, voice: synthOpts.voice, input: text, response_format: 'mp3' }),
        timeoutMs: TTS_TIMEOUT_MS,
        fetchImpl: opts.fetchImpl,
      });
    },
  };
}
