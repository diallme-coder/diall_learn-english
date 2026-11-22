// src/server/deps.ts
//
// Wires the real `ServerDeps` for production, as lazy singletons (built
// once on first use, from `loadEnv()`), plus `buildFakeDeps()` for handler
// tests, built entirely from F1's ports/fakes — no real network, ever, in
// a test.
//
// `ServerDeps` exported here is NOT the frozen `../lib/types.ts` one:
// `src/lib/types.ts` is a frozen contract, so the `PrivacyStore` extension
// (`hasCurrentConsent`, added in `src/lib/ports/index.ts`) can't be folded
// into it there. This local type carries that extension through so every
// consumer that goes through `getServerDeps`/`buildFakeDeps` (handlers,
// `common.ts`'s `GuardContext`) sees the real, richer shape both factories
// below actually build.

import type { ServerDeps as BaseServerDeps } from '../lib/types.ts';
import type { PrivacyStore } from '../lib/ports/index.ts';
import { createRateLimiter, createFixedClock } from '../lib/ports/index.ts';
import {
  createFakeAuth,
  createFakeChatModel,
  createFakeRateLimiter,
  createFakeSynthesizer,
  createFakeTranscriber,
  createInMemoryPrivacyStore,
  createInMemoryProgressStore,
  createMemoryTtsCache as createFakeTtsCache,
} from '../lib/ports/index.ts';

export type ServerDeps = Omit<BaseServerDeps, 'privacy'> & { privacy: PrivacyStore };
import { parseClientIp } from '../lib/security/clientIp.ts';
import { loadEnv, type ServerEnv } from './env.ts';
import { createOpenAiTranscriber } from './adapters/openaiTranscriber.ts';
import { createOpenAiTts } from './adapters/openaiTts.ts';
import { createAnthropicChat } from './adapters/anthropicChat.ts';
import { createOpenAiChat } from './adapters/openaiChat.ts';
import { createSupabaseAuth } from './adapters/supabaseAuth.ts';
import { createSupabaseProgress } from './adapters/supabaseProgress.ts';
import { createSupabasePrivacy } from './adapters/supabasePrivacy.ts';
import { createMemoryTtsCache } from './adapters/memoryTtsCache.ts';

let cachedEnv: ServerEnv | null = null;
function env(): ServerEnv {
  if (!cachedEnv) cachedEnv = loadEnv();
  return cachedEnv;
}

let cachedDeps: ServerDeps | null = null;

/** Builds (once) and returns the real, production `ServerDeps`. */
export function getServerDeps(): ServerDeps {
  if (cachedDeps) return cachedDeps;
  const e = env();

  const chat =
    e.llmProvider === 'openai'
      ? createOpenAiChat({ apiKey: e.openaiApiKey, model: e.openaiChatModel })
      : createAnthropicChat({ apiKey: e.anthropicApiKey!, model: e.anthropicModel });

  cachedDeps = {
    transcriber: createOpenAiTranscriber({ apiKey: e.openaiApiKey }),
    chat,
    tts: createOpenAiTts({ apiKey: e.openaiApiKey, model: e.openaiTtsModel }),
    ttsCache: createMemoryTtsCache(),
    auth: createSupabaseAuth({ supabaseUrl: e.supabaseUrl, anonKey: e.supabaseAnonKey }),
    progress: createSupabaseProgress({ supabaseUrl: e.supabaseUrl, anonKey: e.supabaseAnonKey }),
    privacy: createSupabasePrivacy({ supabaseUrl: e.supabaseUrl, anonKey: e.supabaseAnonKey }),
    limiter: createRateLimiter(),
    clock: { now: () => Date.now() },
    clientIp: (req: Request) => parseClientIp(req.headers, e.trustedProxyHops),
    allowedOrigins: e.allowedOrigins,
    ttsVoice: e.openaiTtsVoice,
  };
  return cachedDeps;
}

export interface FakeDepsOverrides {
  startMs?: number;
  allowedOrigins?: readonly string[];
  ttsVoice?: string;
  rateLimitPolicy?: 'allow' | 'deny';
}

/** Builds a fresh `ServerDeps` entirely out of F1's in-memory fakes, for handler tests. */
export function buildFakeDeps(overrides: FakeDepsOverrides = {}): ServerDeps {
  const clock = createFixedClock(overrides.startMs ?? Date.now());
  return {
    transcriber: createFakeTranscriber([]),
    chat: createFakeChatModel([]),
    tts: createFakeSynthesizer(),
    ttsCache: createFakeTtsCache(),
    auth: createFakeAuth({}),
    progress: createInMemoryProgressStore({
      profile: { level: null, nativeLang: 'fr', ageBand: null, consent: null, settings: {
        captionsOn: true, playbackRate: 0.85, textAnswerMode: false, sideCardAutoCollapse: true,
        silenceAnnouncementsWhileRecording: true,
      } },
      vocabulary: [], weakPhonemes: [], recentSessions: [], srsCards: [], streakDays: 0,
    }),
    privacy: createInMemoryPrivacyStore(
      {
        exportedAt: clock.now(),
        profile: { level: null, nativeLang: 'fr', ageBand: null, consent: null, settings: {
          captionsOn: true, playbackRate: 0.85, textAnswerMode: false, sideCardAutoCollapse: true,
          silenceAnnouncementsWhileRecording: true,
        } },
        sessions: [], vocabulary: [], weakPhonemes: [], drillAttempts: [], srsCards: [], consents: [],
      },
      clock,
    ),
    limiter: createFakeRateLimiter(overrides.rateLimitPolicy ?? 'allow'),
    clock,
    clientIp: (req: Request) => parseClientIp(req.headers, 1),
    allowedOrigins: overrides.allowedOrigins ?? ['https://parle-to-speak.app'],
    ttsVoice: overrides.ttsVoice ?? 'alloy',
  };
}
