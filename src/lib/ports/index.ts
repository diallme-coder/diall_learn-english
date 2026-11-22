// src/lib/ports/index.ts
//
// Re-exports the port types (defined in ../types.ts) alongside the fake
// implementations used in tests, plus the real in-memory RateLimiter from
// ../security/rateLimit.ts (it needs no external service, so there is no
// separate "real adapter" for it).

export type {
  AuthContext,
  AuthVerifier,
  ChatCompletionRequest,
  ChatModel,
  Clock,
  ProgressStore,
  RateLimitDecision,
  RateLimiter,
  ServerDeps,
  SpeechSynthesizer,
  Transcriber,
  TranscribeOptions,
  TtsCache,
} from '../types.ts';

// `PrivacyStore` is extended here (additively) with a lightweight consent
// existence check, so routes that merely gate on "has the user accepted
// PRIVACY_CONSENT_VERSION" don't need a full `exportAll` call. `types.ts`
// is frozen, so this lives alongside the port rather than inside it.
import type { AuthContext as _AuthContext, PrivacyStore as BasePrivacyStore, Result as _Result } from '../types.ts';
export type PrivacyStore = BasePrivacyStore & {
  hasCurrentConsent(auth: _AuthContext, version: string): Promise<_Result<boolean>>;
};

export { createRateLimiter } from '../security/rateLimit.ts';

export {
  createFakeAuth,
  createFakeChatModel,
  createFakeRateLimiter,
  createFakeSynthesizer,
  createFakeTranscriber,
  createFixedClock,
  createInMemoryPrivacyStore,
  createInMemoryProgressStore,
  createMemoryTtsCache,
} from './fakes.ts';
export type {
  FakeAuthHandle,
  FakeChatModelHandle,
  FakeClock,
  FakePrivacyStoreHandle,
  FakeProgressStoreHandle,
  FakeSynthesizerHandle,
  FakeTranscript,
  FakeTranscriberHandle,
  FakeTtsCacheHandle,
} from './fakes.ts';
