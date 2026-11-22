// src/lib/ports/fakes.ts
//
// Deterministic, configurable in-memory fakes for every ServerDeps port.
// These exist so F2's handler tests (and later unit tests here) can wire
// up a full `ServerDeps` without any real network, Supabase, OpenAI or
// Anthropic access. They are clearly fake: no retries, no timeouts, no
// real crypto — just enough behaviour to drive handler logic.

import type {
  AuthContext,
  AuthVerifier,
  ChatCompletionRequest,
  ChatModel,
  Clock,
  ConsentRecord,
  AgeBand,
  EpochMs,
  AudioInput,
  PrivacyExport,
  ProgressEvent,
  ProgressSnapshot,
  ProgressStore,
  RateLimitDecision,
  RateLimitedRoute,
  RateLimiter,
  Result,
  SpeechSynthesizer,
  Transcriber,
  TranscribeOptions,
  Transcript,
  TtsCache,
  UserId,
} from '../types.ts';
// `PrivacyStore` here is the additive (hasCurrentConsent) version from
// `./index.ts`, not the frozen base in `../types.ts` — see that file.
import type { PrivacyStore } from './index.ts';

// ───────────────────────── Clock ─────────────────────────

export interface FakeClock extends Clock {
  advance(ms: number): void;
  set(ms: EpochMs): void;
}

export function createFixedClock(startMs: EpochMs): FakeClock {
  let current = startMs;
  return {
    now() {
      return current;
    },
    advance(ms: number) {
      current += ms;
    },
    set(ms: EpochMs) {
      current = ms;
    },
  };
}

// ───────────────────────── Transcriber ─────────────────────────

export type FakeTranscript = Transcript & { noSpeechProb: number };

export interface FakeTranscriberHandle extends Transcriber {
  readonly calls: ReadonlyArray<{ audio: AudioInput; opts: TranscribeOptions }>;
}

/** Returns each scripted result in sequence; the last entry repeats once the script runs out. */
export function createFakeTranscriber(script: ReadonlyArray<Result<FakeTranscript>>): FakeTranscriberHandle {
  const calls: Array<{ audio: AudioInput; opts: TranscribeOptions }> = [];
  let index = 0;
  return {
    calls,
    async transcribe(audio, opts) {
      calls.push({ audio, opts });
      const result = script[Math.min(index, script.length - 1)];
      index += 1;
      if (!result) {
        return { ok: false, error: { code: 'internal', message: 'fake transcriber script is empty' } };
      }
      return result;
    },
  };
}

// ───────────────────────── ChatModel ─────────────────────────

export interface FakeChatModelHandle extends ChatModel {
  readonly calls: ReadonlyArray<ChatCompletionRequest>;
}

/** Returns each scripted result in sequence; the last entry repeats once the script runs out. */
export function createFakeChatModel(script: ReadonlyArray<Result<string>>): FakeChatModelHandle {
  const calls: ChatCompletionRequest[] = [];
  let index = 0;
  return {
    calls,
    async complete(req) {
      calls.push(req);
      const result = script[Math.min(index, script.length - 1)];
      index += 1;
      if (!result) {
        return { ok: false, error: { code: 'internal', message: 'fake chat model script is empty' } };
      }
      return result;
    },
  };
}

// ───────────────────────── SpeechSynthesizer ─────────────────────────

export interface FakeSynthesizerHandle extends SpeechSynthesizer {
  readonly calls: ReadonlyArray<{ text: string; voice: string }>;
}

export function createFakeSynthesizer(
  script: ReadonlyArray<Result<Uint8Array>> = [{ ok: true, value: new Uint8Array([1, 2, 3]) }],
): FakeSynthesizerHandle {
  const calls: Array<{ text: string; voice: string }> = [];
  let index = 0;
  return {
    calls,
    async synthesize(text, opts) {
      calls.push({ text, voice: opts.voice });
      const result = script[Math.min(index, script.length - 1)];
      index += 1;
      if (!result) {
        return { ok: false, error: { code: 'internal', message: 'fake synthesizer script is empty' } };
      }
      return result;
    },
  };
}

// ───────────────────────── TtsCache ─────────────────────────

export interface FakeTtsCacheHandle extends TtsCache {
  readonly getCalls: readonly string[];
  readonly setCalls: ReadonlyArray<{ key: string; bytes: Uint8Array }>;
}

export function createMemoryTtsCache(): FakeTtsCacheHandle {
  const store = new Map<string, Uint8Array>();
  const getCalls: string[] = [];
  const setCalls: Array<{ key: string; bytes: Uint8Array }> = [];
  return {
    getCalls,
    setCalls,
    async get(key) {
      getCalls.push(key);
      return store.get(key) ?? null;
    },
    async set(key, bytes) {
      setCalls.push({ key, bytes });
      store.set(key, bytes);
    },
  };
}

// ───────────────────────── AuthVerifier ─────────────────────────

export interface FakeAuthHandle extends AuthVerifier {
  readonly calls: ReadonlyArray<{ authorizationHeader: string | null; nowMs: EpochMs }>;
}

/** `tokens` maps a bearer token (without "Bearer ") to the AuthContext it should resolve to. */
export function createFakeAuth(tokens: Record<string, AuthContext> = {}): FakeAuthHandle {
  const calls: Array<{ authorizationHeader: string | null; nowMs: EpochMs }> = [];
  return {
    calls,
    async verify(authorizationHeader, nowMs) {
      calls.push({ authorizationHeader, nowMs });
      if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
        return { ok: false, error: { code: 'unauthorized', message: 'Missing bearer token.' } };
      }
      const token = authorizationHeader.slice('Bearer '.length);
      const context = tokens[token];
      if (!context) {
        return { ok: false, error: { code: 'unauthorized', message: 'Unknown token.' } };
      }
      return { ok: true, value: context };
    },
  };
}

// ───────────────────────── ProgressStore ─────────────────────────

export interface FakeProgressStoreHandle extends ProgressStore {
  readonly recordedEvents: ReadonlyArray<{ userId: UserId; event: ProgressEvent }>;
}

export function createInMemoryProgressStore(initialSnapshot: ProgressSnapshot): FakeProgressStoreHandle {
  const recordedEvents: Array<{ userId: UserId; event: ProgressEvent }> = [];
  return {
    recordedEvents,
    async getSnapshot(_auth) {
      return { ok: true, value: initialSnapshot };
    },
    async record(auth, event) {
      recordedEvents.push({ userId: auth.userId, event });
      return { ok: true, value: null };
    },
  };
}

// ───────────────────────── PrivacyStore ─────────────────────────

export interface FakePrivacyStoreHandle extends PrivacyStore {
  readonly consents: ReadonlyArray<{ userId: UserId; version: string; ageBand: AgeBand; acceptedAt: EpochMs }>;
  readonly deletedUserIds: readonly UserId[];
}

/**
 * `consentPolicy` configures `hasCurrentConsent` for tests that gate on it:
 * 'granted' (default) always reports consent present, 'missing' always
 * reports it absent, and 'error' always fails (to exercise fail-closed
 * handling). It does not look at `consents` — most handler tests never
 * call `acceptConsent` and must still pass with the default.
 */
export function createInMemoryPrivacyStore(
  exportValue: PrivacyExport,
  clock: Clock,
  consentPolicy: 'granted' | 'missing' | 'error' = 'granted',
): FakePrivacyStoreHandle {
  const consents: Array<{ userId: UserId; version: string; ageBand: AgeBand; acceptedAt: EpochMs }> = [];
  const deletedUserIds: UserId[] = [];
  return {
    consents,
    deletedUserIds,
    async acceptConsent(auth, version, ageBand) {
      const record: ConsentRecord = { version, acceptedAt: clock.now() };
      consents.push({ userId: auth.userId, version, ageBand, acceptedAt: record.acceptedAt });
      return { ok: true, value: null };
    },
    async exportAll(_auth) {
      return { ok: true, value: exportValue };
    },
    async deleteAccount(auth) {
      deletedUserIds.push(auth.userId);
      return { ok: true, value: null };
    },
    async hasCurrentConsent(_auth, _version) {
      if (consentPolicy === 'error') {
        return { ok: false, error: { code: 'internal', message: 'fake privacy store: consent check error' } };
      }
      return { ok: true, value: consentPolicy === 'granted' };
    },
  };
}

// ───────────────────────── RateLimiter ─────────────────────────

/** Always allows (or always denies) regardless of scope/key/route — for handler tests that don't exercise rate limiting. */
export function createFakeRateLimiter(policy: 'allow' | 'deny' = 'allow'): RateLimiter {
  return {
    take(_scope: 'ip' | 'user', _key: string, _route: RateLimitedRoute, _nowMs: EpochMs): RateLimitDecision {
      if (policy === 'allow') return { allowed: true, remaining: 999, retryAfterSec: 0 };
      return { allowed: false, remaining: 0, retryAfterSec: 60 };
    },
  };
}
