// src/server/adapters/openaiChat.ts
//
// Implements `ChatModel` via OpenAI's `/v1/chat/completions`, as an
// alternative/fallback provider to `anthropicChat.ts` (same `ChatModel`
// shape, different endpoint/auth). For `responseFormat: 'json'`, uses
// OpenAI's native `response_format: {type: 'json_object'}` instead of a
// prefill trick (OpenAI supports this directly).

import type { ChatCompletionRequest, ChatModel, Result } from '../../lib/types.ts';
import { fetchJson, type FetchImpl } from '../fetchJson.ts';

const CHAT_TIMEOUT_MS = 20_000;

interface OpenAiChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export interface OpenAiChatOptions {
  apiKey: string;
  model: string;
  fetchImpl?: FetchImpl;
  baseUrl?: string;
}

export function createOpenAiChat(opts: OpenAiChatOptions): ChatModel {
  const baseUrl = opts.baseUrl ?? 'https://api.openai.com';

  return {
    async complete(req: ChatCompletionRequest): Promise<Result<string>> {
      const messages = [
        { role: 'system', content: req.system },
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const result = await fetchJson<OpenAiChatCompletionResponse>(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${opts.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: opts.model,
          messages,
          max_tokens: req.maxTokens,
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
          ...(req.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
        }),
        timeoutMs: CHAT_TIMEOUT_MS,
        fetchImpl: opts.fetchImpl,
      });
      if (!result.ok) return result;

      const content = result.value.choices?.[0]?.message?.content ?? '';
      return { ok: true, value: content };
    },
  };
}
