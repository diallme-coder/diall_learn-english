// src/server/adapters/anthropicChat.ts
//
// Implements `ChatModel` via `POST https://api.anthropic.com/v1/messages`
// (`x-api-key`, `anthropic-version` headers). Maps
// `ChatCompletionRequest.system/messages/maxTokens/temperature`.
//
// JSON-mode strategy (documented per src/lib/prompts/debateFeedback.ts):
// Anthropic's API has no native JSON-mode flag, so for
// `responseFormat: 'json'` this adapter appends an assistant turn
// consisting of the single character '{' (a "prefill") to the request.
// The model's completion then continues directly from that character, so
// Anthropic returns the completion WITHOUT the leading '{' — this adapter
// prepends it back before returning the string, so callers (e.g.
// `parseDebateFeedback`) always see a string that starts with '{'.

import type { ChatCompletionRequest, ChatModel, Result } from '../../lib/types.ts';
import { fetchJson, type FetchImpl } from '../fetchJson.ts';

const CHAT_TIMEOUT_MS = 20_000;
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicMessagesResponse {
  content?: Array<{ type: string; text?: string }>;
}

export interface AnthropicChatOptions {
  apiKey: string;
  model: string;
  fetchImpl?: FetchImpl;
  baseUrl?: string;
}

export function createAnthropicChat(opts: AnthropicChatOptions): ChatModel {
  const baseUrl = opts.baseUrl ?? 'https://api.anthropic.com';

  return {
    async complete(req: ChatCompletionRequest): Promise<Result<string>> {
      const jsonMode = req.responseFormat === 'json';
      const messages = [
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
        ...(jsonMode ? [{ role: 'assistant' as const, content: '{' }] : []),
      ];

      const result = await fetchJson<AnthropicMessagesResponse>(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': opts.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          system: req.system,
          messages,
          max_tokens: req.maxTokens,
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        }),
        timeoutMs: CHAT_TIMEOUT_MS,
        fetchImpl: opts.fetchImpl,
      });
      if (!result.ok) return result;

      const textBlock = result.value.content?.find((b) => b.type === 'text');
      const completion = textBlock?.text ?? '';
      return { ok: true, value: jsonMode ? `{${completion}` : completion };
    },
  };
}
