import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnthropicChat } from './anthropicChat.ts';
import type { FetchImpl } from '../fetchJson.ts';

test('createAnthropicChat: sends system/messages/maxTokens and the right headers; key only in x-api-key', async () => {
  let capturedUrl = '';
  let capturedHeaders: Record<string, string> | undefined;
  let capturedBody: Record<string, unknown> | undefined;
  const fetchImpl: FetchImpl = (async (url: string, init?: RequestInit) => {
    capturedUrl = url;
    capturedHeaders = init?.headers as Record<string, string>;
    capturedBody = JSON.parse(init?.body as string);
    return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Hello!' }] }), { status: 200 });
  }) as unknown as FetchImpl;

  const chat = createAnthropicChat({ apiKey: 'sk-ant-test', model: 'claude-3-5-haiku-latest', fetchImpl });
  const result = await chat.complete({
    system: 'be nice',
    messages: [{ role: 'user', content: 'hi' }],
    maxTokens: 100,
  });

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value, 'Hello!');
  assert.equal(capturedUrl, 'https://api.anthropic.com/v1/messages');
  assert.equal(capturedHeaders!['x-api-key'], 'sk-ant-test');
  assert.equal(capturedHeaders!['anthropic-version'], '2023-06-01');
  assert.equal(capturedBody!.system, 'be nice');
  assert.equal(capturedBody!.max_tokens, 100);
  assert.deepEqual(capturedBody!.messages, [{ role: 'user', content: 'hi' }]);
});

test('createAnthropicChat: JSON mode prepends assistant "{" prefill and restores it on the result', async () => {
  let capturedBody: { messages: Array<{ role: string; content: string }> } | undefined;
  const fetchImpl: FetchImpl = (async (_url: string, init?: RequestInit) => {
    capturedBody = JSON.parse(init?.body as string);
    // The model's completion CONTINUES from the '{' prefill, so Anthropic
    // returns it WITHOUT the leading '{'.
    return new Response(JSON.stringify({ content: [{ type: 'text', text: '"items": []}' }] }), { status: 200 });
  }) as unknown as FetchImpl;

  const chat = createAnthropicChat({ apiKey: 'sk-ant-test', model: 'm', fetchImpl });
  const result = await chat.complete({ system: 's', messages: [], maxTokens: 50, responseFormat: 'json' });

  assert.equal(result.ok, true);
  const lastMessage = capturedBody!.messages[capturedBody!.messages.length - 1]!;
  assert.deepEqual(lastMessage, { role: 'assistant', content: '{' });
  if (result.ok) assert.equal(result.value.startsWith('{'), true);
  if (result.ok) assert.equal(result.value, '{"items": []}');
});
