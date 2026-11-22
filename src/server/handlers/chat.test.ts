import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatHandler } from './chat.ts';
import { buildFakeDeps } from '../deps.ts';
import { fakeJwt, makeJsonRequest } from '../fixtures/requests.ts';
import { createFakeAuth, createFakeChatModel } from '../../lib/ports/index.ts';
import type { ServerDeps } from '../deps.ts';
import { DEBATE_TOPICS } from '../../lib/levels/index.ts';

const ORIGIN = 'https://parle-to-speak.app';
const URL = 'https://parle-to-speak.app/api/chat';

function authedDeps(): { deps: ServerDeps; token: string } {
  const deps = buildFakeDeps({ allowedOrigins: [ORIGIN] });
  const token = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
  deps.auth = createFakeAuth({ [token]: { userId: 'u1', accessToken: token } });
  return { deps, token };
}

test('chatHandler: reply action for a roleplay scenario fills codeSwitch from the latest user message', async () => {
  const { deps, token } = authedDeps();
  deps.chat = createFakeChatModel([{ ok: true, value: 'Sure, one flat white coming up!' }]);
  const req = makeJsonRequest(
    URL,
    {
      action: 'reply',
      mode: 'roleplay',
      level: 'B1',
      scenarioId: 'cafe',
      messages: [{ role: 'user', content: 'I was stuck in traffic, an embouteillage really' }],
    },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const res = await chatHandler(req, deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.action, 'reply');
  assert.equal(body.reply, 'Sure, one flat white coming up!');
  assert.ok(body.codeSwitch);
  assert.ok(body.codeSwitch.spans.length > 0);
});

test('chatHandler: an unknown scenarioId is rejected (400)', async () => {
  const { deps, token } = authedDeps();
  const req = makeJsonRequest(
    URL,
    { action: 'reply', mode: 'roleplay', level: 'B1', scenarioId: 'not-a-real-scenario', messages: [] },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const res = await chatHandler(req, deps);
  assert.equal(res.status, 400);
});

test('chatHandler: a history longer than chatHistoryWindow is truncated, not rejected', async () => {
  const { deps, token } = authedDeps();
  deps.chat = createFakeChatModel([{ ok: true, value: 'ok' }]);
  const messages = Array.from({ length: 25 }, (_, i) => ({ role: 'user' as const, content: `msg ${i}` }));
  const req = makeJsonRequest(
    URL,
    { action: 'reply', mode: 'roleplay', level: 'B1', scenarioId: 'cafe', messages },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const res = await chatHandler(req, deps);
  assert.equal(res.status, 200);
  const sentMessages = (deps.chat as ReturnType<typeof createFakeChatModel>).calls[0]!.messages;
  assert.equal(sentMessages.length, 20);
  // 'user' content is now wrapped (see chatHandler's sanitizeForPrompt/wrapLearnerUtterance
  // call) before it reaches the model, so check containment rather than exact equality.
  assert.ok(sentMessages[sentMessages.length - 1]!.content.includes('msg 24'));
});

test('chatHandler: debate_feedback fills codeSwitchCards server-side from analyzeCodeSwitch over userTurns', async () => {
  const { deps, token } = authedDeps();
  const topic = DEBATE_TOPICS[0]!;
  deps.chat = createFakeChatModel([
    {
      ok: true,
      value: JSON.stringify({
        items: [],
        idiomsUsed: [],
        idiomsToTry: [],
        summaryFr: 'Bien joue !',
      }),
    },
  ]);
  const req = makeJsonRequest(
    URL,
    { action: 'debate_feedback', level: 'C1', topicId: topic.id, userTurns: ['Je pense que oui'] },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const res = await chatHandler(req, deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.action, 'debate_feedback');
  assert.ok(Array.isArray(body.feedback.codeSwitchCards));
});

test('chatHandler: 9 x 1900-char debate turns exceed maxDebateFeedbackChars -> 400', async () => {
  const { deps, token } = authedDeps();
  const topic = DEBATE_TOPICS[0]!;
  const userTurns = Array.from({ length: 9 }, () => 'a'.repeat(1900));
  const req = makeJsonRequest(
    URL,
    { action: 'debate_feedback', level: 'C1', topicId: topic.id, userTurns },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const res = await chatHandler(req, deps);
  assert.equal(res.status, 400);
});
