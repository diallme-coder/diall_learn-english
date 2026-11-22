import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAiChat } from './openaiChat.ts';
import type { FetchImpl } from '../fetchJson.ts';

test('createOpenAiChat: sends messages with a prepended system role; key only in Authorization', async () => {
  let capturedHeaders: Record<string, string> | undefined;
  let capturedBody: { messages: Array<{ role: string; content: string }> } | undefined;
  const fetchImpl: FetchImpl = (async (_url: string, init?: RequestInit) => {
    capturedHeaders = init?.headers as Record<string, string>;
    capturedBody = JSON.parse(init?.body as string);
    return new Response(JSON.stringify({ choices: [{ message: { content: 'hi there' } }] }), { status: 200 });
  }) as unknown as FetchImpl;

  const chat = createOpenAiChat({ apiKey: 'sk-test', model: 'gpt-4o-mini', fetchImpl });
  const result = await chat.complete({ system: 'be nice', messages: [{ role: 'user', content: 'hi' }], maxTokens: 10 });

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value, 'hi there');
  assert.equal(capturedHeaders!.authorization, 'Bearer sk-test');
  assert.deepEqual(capturedBody!.messages[0], { role: 'system', content: 'be nice' });
});

test('createOpenAiChat: JSON mode sets response_format json_object', async () => {
  let capturedBody: { response_format?: { type: string } } | undefined;
  const fetchImpl: FetchImpl = (async (_url: string, init?: RequestInit) => {
    capturedBody = JSON.parse(init?.body as string);
    return new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 });
  }) as unknown as FetchImpl;
  const chat = createOpenAiChat({ apiKey: 'sk-test', model: 'm', fetchImpl });
  await chat.complete({ system: 's', messages: [], maxTokens: 10, responseFormat: 'json' });
  assert.deepEqual(capturedBody!.response_format, { type: 'json_object' });
});
