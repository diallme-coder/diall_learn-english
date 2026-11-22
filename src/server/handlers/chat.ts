// src/server/handlers/chat.ts
//
// POST /api/chat. `parseChatRequest` is wired to the REAL scenario/topic
// catalogs (E), unlike F1's own validate.ts tests (which use local
// fixtures). Message history is already truncated to
// `LIMITS.chatHistoryWindow` inside `parseChatRequest`.
//
// `ChatResponse.codeSwitch` (reply action): the request carries no
// separate "utterance" field — the user's current-turn utterance is the
// last message in `messages` with `role: 'user'`. `codeSwitch` is
// `analyzeCodeSwitch` over that message's content, or `null` when there is
// no user message in the truncated history (should not normally happen,
// but the type allows it).

import type { ChatRequest, ChatResponse, Result } from '../../lib/types.ts';
import { LIMITS } from '../../lib/types.ts';
import type { ServerDeps } from '../deps.ts';
import { readBodyCapped } from '../../lib/security/audio.ts';
import { parseChatRequest } from '../../lib/security/validate.ts';
import { clamp, sanitizeForPrompt, wrapLearnerUtterance } from '../../lib/security/sanitize.ts';
import { buildTutorSystemPrompt } from '../../lib/prompts/tutor.ts';
import { buildDebateFeedbackPrompt } from '../../lib/prompts/debateFeedback.ts';
import { getScenario, getTopic, IDIOMS, parseDebateFeedback } from '../../lib/levels/index.ts';
import { isOneOf, SCENARIO_IDS } from '../../lib/types.ts';
import { EN_FALSE_FRIENDS } from '../../lib/codeswitch/enFalseFriends.ts';
import { analyzeCodeSwitch } from '../../lib/codeswitch/index.ts';
import { withGuards, type GuardContext } from './common.ts';
import { errorResponse, jsonResponse } from '../http.ts';

async function parseJsonBody(req: Request): Promise<Result<unknown>> {
  const capped = await readBodyCapped(req, LIMITS.maxJsonBodyBytes);
  if (!capped.ok) return capped;
  try {
    const text = new TextDecoder().decode(capped.value);
    return { ok: true, value: text.length === 0 ? {} : JSON.parse(text) };
  } catch {
    return { ok: false, error: { code: 'bad_request', message: 'Body is not valid JSON.' } };
  }
}

async function handleReply(request: ChatRequest & { action: 'reply' }, deps: ServerDeps): Promise<Response> {
  const scenario = request.mode === 'roleplay' ? getScenario(request.scenarioId) : undefined;
  const topic = request.mode === 'debate' ? getTopic(request.topicId) : undefined;

  const system = buildTutorSystemPrompt({
    mode: request.mode,
    level: request.level,
    scenario,
    topic,
    enFalseFriendsHint: EN_FALSE_FRIENDS.map((f) => f.en),
  });

  // Learner-authored turns are DATA, never instructions (per buildTutorSystemPrompt's own
  // framing): sanitize and wrap each 'user' message's content before it reaches the model,
  // so a learner can't smuggle a closing </learner_utterance> tag plus new instructions.
  // 'assistant' turns are left as-is here — they are still client-supplied, but rebuilding
  // the reply history server-side is a larger change, out of scope for this fix.
  const sanitizedMessages = request.messages.map((m) =>
    m.role === 'user'
      ? { ...m, content: wrapLearnerUtterance(sanitizeForPrompt(m.content, LIMITS.maxMessageChars)) }
      : m,
  );

  const completion = await deps.chat.complete({
    system,
    messages: sanitizedMessages,
    maxTokens: LIMITS.maxReplyTokens,
  });
  if (!completion.ok) return errorResponse(completion.error);

  const lastUserMessage = [...request.messages].reverse().find((m) => m.role === 'user');
  const codeSwitch = lastUserMessage ? analyzeCodeSwitch(lastUserMessage.content) : null;

  const response: ChatResponse = {
    action: 'reply',
    reply: clamp(completion.value, LIMITS.maxMessageChars),
    codeSwitch,
  };
  return jsonResponse(response);
}

async function handleDebateFeedback(
  request: ChatRequest & { action: 'debate_feedback' },
  deps: ServerDeps,
): Promise<Response> {
  const topic = getTopic(request.topicId);
  if (!topic) return errorResponse({ code: 'not_found', message: 'Unknown debate topic.' });
  const idioms = IDIOMS.filter((idiom) => topic.idiomIds.includes(idiom.id));

  const prompt = buildDebateFeedbackPrompt({ topic, userTurns: request.userTurns, idioms });
  const completion = await deps.chat.complete({
    system: prompt,
    messages: [],
    maxTokens: LIMITS.maxFeedbackTokens,
    responseFormat: 'json',
  });
  if (!completion.ok) return errorResponse(completion.error);

  const parsed = parseDebateFeedback(completion.value);
  if (!parsed.ok) return errorResponse(parsed.error);

  const codeSwitchCards = analyzeCodeSwitch(request.userTurns.join('\n')).cards;
  const response: ChatResponse = {
    action: 'debate_feedback',
    feedback: { ...parsed.value, codeSwitchCards },
  };
  return jsonResponse(response);
}

async function handleChat(ctx: GuardContext): Promise<Response> {
  const bodyResult = await parseJsonBody(ctx.req);
  if (!bodyResult.ok) return errorResponse(bodyResult.error);

  const parsed = parseChatRequest(bodyResult.value, {
    topicExists: (id) => getTopic(id) !== undefined,
    scenarioExists: (id) => isOneOf(SCENARIO_IDS, id) && getScenario(id) !== undefined,
  });
  if (!parsed.ok) return errorResponse(parsed.error);

  if (parsed.value.action === 'reply') return handleReply(parsed.value, ctx.deps);
  return handleDebateFeedback(parsed.value, ctx.deps);
}

export async function chatHandler(req: Request, deps: ServerDeps): Promise<Response> {
  return withGuards(req, deps, { route: 'chat', methods: ['POST'] }, handleChat);
}
