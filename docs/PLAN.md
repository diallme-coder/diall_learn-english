# Parle-to-Speak: Build Plan

Status: revision 2, after the architect and critic reviews. This is the only planned revision round. Date: 2026-11-21. Scope: the v1 build.

Design inputs are `docs/design/01..05-*.md`, where `05-accessibility.md` is new in this revision. The designer agent owns `src/styles/tokens.css` and `src/styles/globals.css`; no unit in this plan writes those files.

Acceptance tags used throughout:
- **[HERE]** means the check runs in this offline environment.
- **[MANUAL]** means it needs `npm install` or a browser. Each [MANUAL] item is listed in `docs/MANUAL_QA.md` with an owner and an expected result.

---

## 1. Context

Parle-to-Speak is a voice-first, mobile-first PWA where French speakers practise speaking English. v1 covers six areas:

- a Franglais code-switch safety net
- a pronunciation "intelligibility check" for the usual French-speaker traps
- level-adapted modes A1-C1: shadowing, guided roleplay, debate
- 2-minute daily micro-drills with spaced repetition
- Supabase-backed progress
- privacy controls (consent, export, delete)

The routes, labels and UX rules come from `docs/design/02..05`.

### v1 scope decision: push-to-talk, realtime deferred to v2

The conversation loop is: record, `POST /api/transcribe`, `POST /api/chat`, then `GET /api/tts`. TTS uses OpenAI TTS for a fixed, cached catalog. If that fails, the browser's `speechSynthesis` is used. If no English voice exists, the app falls back to text only.

The following are all v2 and do not appear in this plan's files: WebRTC realtime, `/api/realtime-token`, `RealtimeTokenMinter`, `openaiRealtime.ts`, `src/client/realtime.ts`.

v1 routes: `transcribe`, `chat`, `tts`, `progress`, `privacy`. Pronunciation scoring is folded into `/api/transcribe`: the client sends an optional `referenceText` form field and the server returns a `report`. This means the client never supplies the transcript it is scored on.

### Environment constraints (they shape everything below)

- Node v22.23 is available.
- `tsc` is **7.0.2** at `/home/claude/.npm-global/bin/tsc`. `$HOME` is `/root` and the agent runs as uid 0.
  - `@types/node` is at `/opt/npm-tools/node_modules/@types/node`.
  - `package.json` keeps `typescript@^5.8` for Next. The global tsc 7 is used only for `typecheck:lib` here.
- There is no network. `next`, `react` types and so on cannot be installed, so `next build` cannot run here.
- Postgres 16 binaries are at `/usr/lib/postgresql/16/bin`. `initdb`/`pg_ctl` refuse to run as root, so unit G's script uses `runuser -u postgres --` on a `mktemp -d` directory chowned to postgres.
- What follows from this:
  1. All logic lives in framework-free, dependency-free TypeScript under `src/lib/**`.
  2. Server adapters and handlers live in `src/server/**` and use only Web-standard `Request`/`Response`/`fetch`, so they are testable offline.
  3. `app/api/**/route.ts` files are about 3-line re-exports.
  4. `src/client/**` is DOM-only TypeScript with no npm dependencies; auth uses GoTrue REST through `fetch`. `tsc` therefore covers it.
  5. Only `*.tsx` files are unverifiable here. They are covered by `scripts/check-boundaries.mjs` and `scripts/check-routes.mjs` plus [MANUAL] items.

### TypeScript rules for `src/lib/**`, `src/server/**`, `src/client/**`

These are enforced by `tsconfig.lib.json` (`erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`) and by `check-boundaries`:

- Erasable syntax only: no `enum`, no parameter properties, no `namespace`. Use `as const` lists with `(typeof X)[number]` unions.
- Use `import type` for type-only imports.
- Relative imports end in `.ts`.
- Non-test `src/lib/**` has no bare specifiers, no `node:*`, and no `process.`, `Buffer`, `require(` or `__dirname`.
- `*.test.ts` under `src/lib` may import any `node:*` module.
- No `src/lib` file imports a path that resolves into `src/server`, `src/client`, `src/components` or `app`.
- `src/server/**` may import `src/lib/**`. Nothing reachable from a `'use client'` file, `src/client/**` or `src/components/**` may reach `src/server/**` or `src/lib/prompts/**` (checked over the transitive import closure).
- `.tsx` files import lib modules with the `.ts` extension. The root `tsconfig.json` sets `allowImportingTsExtensions` + `noEmit`.

### Standard verification commands (used by every unit)

```bash
cd /home/claude/parle-to-speak
node --experimental-strip-types --test 'src/lib/<dir>/**/*.test.ts'             # quote the glob
tsc -p tsconfig.lib.json --typeRoots /opt/npm-tools/node_modules/@types         # tsc 7.0.2
node scripts/check-boundaries.mjs && node scripts/check-routes.mjs             # after unit A lands
bash supabase/tests/run-local.sh                                                # unit G; uses runuser as root
```

---

## 2. Work objectives

1. A complete Next.js 15 App Router + TypeScript project the user can `npm install && npm run dev` later.
2. All core behaviour is unit-tested offline: code-switch detection, intelligibility scoring, the hallucination and silence guard, drills/SRS, placement, prompts, validation, rate limiting, handlers, adapters (with fake `fetch`) and client reducers. **The offline tests use synthetic ASR inputs.** Real-audio calibration is a [MANUAL] milestone (unit I, MANUAL_QA §Calibration).
3. A Supabase migration with explicit grants, per-user RLS, idempotent RPCs and account deletion. It is tested against a scratch Postgres here.
4. An installable PWA: manifest, a service worker with a post-build precache list, an offline shell and mic-permission handling.
5. Honest privacy handling, plus a README and security docs so the user can configure, deploy and stay compliant.

## 3. Guardrails

### Must have

- API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) are read only from server env. They are never `NEXT_PUBLIC_`, never logged and never put in URLs.
- The browser receives only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. A Supabase `sb_publishable_…` key also works as the `apikey`.
- Every learner transcript sent to an LLM is sanitised and wrapped as data (F, prompts).
- User data reaches Postgres with the user's own JWT. **The database is the real boundary**: users hold the anon key and their JWT, so they can call PostgREST directly. Every constraint that matters (lengths, ranges, enum lists, caps) is therefore enforced in SQL as well as in `validate.ts`.
- Honest privacy copy:
  - The app does not keep audio in its own database.
  - Audio and transcripts **are sent to OpenAI (transcription, TTS) and Anthropic or OpenAI (chat)** to be processed.
  - No copy claims data is "never stored" by those processors.
  - Mic features require a recorded consent (`privacy_consents`) at `PRIVACY_CONSENT_VERSION`.
- Age attestation at sign-in:
  - under 15: blocked, and the age is not stored;
  - 15-17: stored as `ageBand '15-17'`, and sensitive reveal is off;
  - 18 and over: `'18+'`.
- Sensitive content (`MinimalPair.sensitive`) never appears in practice words, shadowing, drills, TTS catalog or random content. That is tested in B, D, E and F.
- Every content catalog is data (`as const`) with shape and count tests.

### Must NOT have

- No SDKs anywhere: no `openai`, no `@anthropic-ai/sdk`, no `@supabase/supabase-js`.
- No `dangerouslySetInnerHTML`.
- No `system` role accepted from the client.
- No caching of `/api/*` (except `/api/tts`, which is immutable public catalog audio and cached by HTTP headers, not by the SW), RSC payloads, redirected responses or non-200 responses in the SW.
- No `referenceText`, and no context prompt, sent to Whisper for `shadowing|pronunciation|placement`. Otherwise Whisper would "correct" toward the expected text.
- No changes to `docs/design/**` or `src/styles/{tokens,globals}.css`. Needed design follow-ups go into §13 as notes to the designer.
- No realtime/WebRTC in v1.

---
## 4. Unit map and dependency graph

v1 has 11 work units plus the unit-0 contract prelude. Each unit owns its files exclusively; the full file lists are in §7 and summarised in §7.0.

| Unit | Name | Hard deps | Soft deps (signatures, §6) | Phase |
|---|---|---|---|---|
| 0 | Shared contract + tooling base | none | none | 0 (first, short) |
| A | Scaffold, PWA, boundary/route checkers | 0 | none | 1 |
| B | `src/lib/pronunciation` (intelligibility check, diagrams) | 0 | none | 1 |
| C | `src/lib/codeswitch` (detector, false friends, hallucination denylist) | 0 | none | 1 |
| D | `src/lib/drills`, `src/lib/srs`, `src/lib/progress` | 0 | none | 1 |
| E | `src/lib/levels` | 0 | none | 1 |
| G | Supabase migration, RLS, RPCs, `src/lib/db` | 0 | none | 1 |
| F | Security, prompts, ports, adapters, handlers, API routes | 0 | B, C, D, E, G | 1 (F1 with fixtures), then F2 tests close after B, C, D, E, G |
| H1 | `src/lib/ui/**`, `src/client/**`: tested client logic | 0 | B, C, D, E, §8 HTTP | 1 |
| H2 | Core-loop screens: onboarding, shadowing, drills, pronunciation, progress, settings, privacy | 0, A, H1 | B, D, E | 2 |
| H3 | Roleplay + debate screens | 0, A, H1 | C, E | 2 (parallel with H2) |
| I | README, SECURITY, MANUAL_QA | none | all | 1 draft, 3 final |

```
                 0  (types.ts, package.json, tsconfig.lib.json)
   ┌─────┬─────┬─────┬─────┬─────┬─────┬──────┬───────┐
   A     B     C     D     E     G     F1    H1     I(draft)
   │     └─────┴──┬──┴─────┴─────┘     │      │
   │              F2 ◄─────────────────┘      │
   └──────────────┬───────────────────────────┘
          H2  ‖  H3    (both need A's layout + H1)
                 │
        Integration gate (§10) → I(final)
```

`src/lib/types.ts` changes go only through unit 0's owner. Once Phase 1 starts, changes are additive only.

---
## 5. Shared contract: `src/lib/types.ts` (unit 0, exact exports)

Unit 0 writes this file verbatim (doc comments may be added). It has no imports and is erasable-only.

- **Export count:** `grep -c '^export' src/lib/types.ts` = **115**. Revision 1 had 82.
- **Runtime exports:** 26 (`Object.keys(await import('./types.ts')).length`).
- **Already checked:** this block type-checks under tsc 7.0.2 with `strict`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess` and NodeNext, and it loads under `node --experimental-strip-types`.

```ts
// src/lib/types.ts: shared contract. No imports. Erasable syntax only.

// ───────── Primitives and generic helpers ─────────
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type CEFRLevel = (typeof CEFR_LEVELS)[number];
export type Lang = 'en' | 'fr';
export type UserId = string;
export type EpochMs = number;

export function isOneOf<T extends string>(list: readonly T[], s: string): s is T {
  return (list as readonly string[]).includes(s);
}

export type AppErrorCode =
  | 'bad_request' | 'unauthorized' | 'forbidden' | 'not_found'
  | 'payload_too_large' | 'unsupported_media_type' | 'rate_limited'
  | 'upstream_error' | 'upstream_timeout' | 'internal';
export interface AppError { code: AppErrorCode; message: string; retryAfterSec?: number }
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };
export interface ApiErrorBody { error: { code: AppErrorCode; message: string } }

// ───────── Enumerations (runtime lists; SQL check lists must equal these) ─────────
export const TRAP_CATEGORIES = ['aspirated_h', 'th', 'vowel_length', 'stress_rhythm'] as const;
export type TrapCategory = (typeof TRAP_CATEGORIES)[number];
export const TRAP_IDS = [
  'h_dropped', 'h_inserted', 'th_as_s', 'th_as_f', 'th_as_t', 'dh_as_z', 'dh_as_d',
  'ih_vs_iy', 'uh_vs_uw', 'stress_misplaced', 'weak_forms',
] as const;
export type TrapId = (typeof TRAP_IDS)[number];
export const TRAP_DEEPLINK = { h: 'aspirated_h', th: 'th', vowels: 'vowel_length', stress: 'stress_rhythm' } as const satisfies Record<string, TrapCategory>;
export type TrapDeeplink = keyof typeof TRAP_DEEPLINK;
export const SCENARIO_IDS = ['cafe', 'job_interview', 'customer_service', 'small_talk'] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];
export const PRACTICE_MODES = ['shadowing', 'roleplay', 'debate'] as const;
export type PracticeMode = (typeof PRACTICE_MODES)[number];
export const SESSION_KINDS = ['shadowing', 'roleplay', 'debate', 'drill', 'placement', 'pronunciation'] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];
export const REVIEW_GRADES = ['again', 'hard', 'good', 'easy'] as const;
export type ReviewGrade = (typeof REVIEW_GRADES)[number];
export const FEEDBACK_TAGS = ['grammar', 'word_choice', 'calque', 'register', 'idiom', 'fluency'] as const;
export type FeedbackTag = (typeof FEEDBACK_TAGS)[number];
export const VOCAB_SOURCES = ['franglais', 'drill', 'session'] as const;
export type VocabSource = (typeof VOCAB_SOURCES)[number];
export const TRANSCRIBE_PURPOSES = ['chat', 'shadowing', 'pronunciation', 'placement'] as const;
export type TranscribePurpose = (typeof TRANSCRIBE_PURPOSES)[number];
export const CHAT_ROLES = ['user', 'assistant'] as const; // 'system' is never accepted from clients
export type ChatRole = (typeof CHAT_ROLES)[number];
export const INPUT_MODES = ['typed', 'spoken', 'self_check'] as const;
export type InputMode = (typeof INPUT_MODES)[number];
export const AGE_BANDS = ['15-17', '18+'] as const; // under 15: blocked at sign-in, never stored
export type AgeBand = (typeof AGE_BANDS)[number];
export const PLAYBACK_RATES = [0.6, 0.85, 1] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];
export const TTS_CATALOGS = ['shadowing', 'hint', 'practice_word'] as const;
export type TtsCatalog = (typeof TTS_CATALOGS)[number];

// ───────── Limits and thresholds (single source of truth) ─────────
export const LIMITS = {
  maxAudioBytes: 4 * 1024 * 1024,          // under Vercel's 4.5 MB request cap
  recorderBitsPerSecond: 32000,
  minRecordingSec: 0.4,
  maxRecordingSec: 60,
  allowedAudioMime: ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'],
  maxJsonBodyBytes: 64 * 1024,
  maxUtteranceChars: 2000,
  maxReferenceTextChars: 300,
  chatHistoryWindow: 20,                   // client sends last 20; server truncates to 20
  maxMessageChars: 2000,
  maxDebateTurns: 40,
  maxDebateFeedbackChars: 16000,           // sum of userTurns; above → 400
  maxSideCardsPerUtterance: 3,
  maxReplyTokens: 400,
  maxFeedbackTokens: 1200,
  maxNoSpeechProb: 0.6,
  minPhonemeAttempts: 5,                   // weak phoneme shown only after N attempts
  maxVocabItemsPerCall: 50,
  maxIdChars: 64,
} as const;
export type AllowedAudioMime = (typeof LIMITS.allowedAudioMime)[number];
export function isAllowedAudioMime(s: string): s is AllowedAudioMime {
  return isOneOf(LIMITS.allowedAudioMime, s);
}

export const RATE_LIMITS = {
  transcribe: { capacity: 20, refillPerMin: 20, dailyBudget: 300 },
  chat:       { capacity: 30, refillPerMin: 30, dailyBudget: 300 },
  tts:        { capacity: 60, refillPerMin: 60, dailyBudget: 500 },
  progress:   { capacity: 60, refillPerMin: 60, dailyBudget: null },
  privacy:    { capacity: 5,  refillPerMin: 1,  dailyBudget: null },
} as const;
export type RateLimitedRoute = keyof typeof RATE_LIMITS;
export const IP_CAPACITY_MULTIPLIER = 2;

export const SCORE_THRESHOLDS = {
  ok: 80, warn: 50, minConfidence: 0.5,
  defaultConfidence: 0.75,                 // used when a word has no confidence
  maxDeletionRatio: 0.6,                   // above → overall null, all words unsure
  isolatedWordMaxTokens: 2,                // 'error' only allowed for references of ≤ 2 tokens
} as const;
export const SHADOWING_PLAYBACK_RATE = 0.85;
export const DAILY_DRILL_BUDGET_SEC = 120;
export const MASTERY_EMA_ALPHA = 0.3;       // client (D) and SQL record_vocab use the same alpha
export const PRIVACY_CONSENT_VERSION = '2026-11-21';

// ───────── Transcripts ─────────
export interface TranscriptWord { text: string; startSec: number; endSec: number; confidence?: number }
export interface Transcript { text: string; language: Lang | 'mixed' | 'unknown'; words: TranscriptWord[]; durationSec: number }
export type TranscribeResponse =
  | { status: 'ok'; transcript: Transcript; codeSwitch: CodeSwitchAnalysis; report: PronunciationReport | null }
  | { status: 'no_speech' };

// ───────── Code-switch (Franglais) ─────────
export type LexiconKind = 'word' | 'phrase' | 'filler' | 'false_friend';
export interface LexiconEntry { fr: string; en: string; kind: LexiconKind; note?: string; example?: string }
export type DetectionReason = 'lexicon' | 'phrase' | 'diacritic' | 'morphology';
export interface DetectedSpan { start: number; end: number; text: string; confidence: number; reason: DetectionReason } // offsets into the ORIGINAL string
export interface SideCard {
  id: string; frenchSpan: string; englishSuggestion: string;
  note: string;                            // French, may be ''
  example?: string; span: { start: number; end: number }; confidence: number;
}
export interface CodeSwitchAnalysis {
  utterance: string; spans: DetectedSpan[]; cards: SideCard[];
  frenchRatio: number; isMostlyEnglish: boolean; allFrench: boolean; needsClarification: boolean;
}

// ───────── Pronunciation ("intelligibility check") ─────────
export interface MinimalPair { target: string; confusedWith: string; targetIpa: string; confusedIpa: string; sensitive?: boolean }
export interface PronunciationTrap {
  id: TrapId; category: TrapCategory; ipa: string;
  titleFr: string; explanationFr: string; mouthTipFr: string;
  substitution: { heardAs: string; exampleFr: string };
  minimalPairs: MinimalPair[]; practiceWords: string[];   // practiceWords never contain sensitive words
}
export type WordScoreStatus = 'ok' | 'warn' | 'error' | 'unsure';
export interface WordScore {
  index: number; expected: string;
  charStart: number; charEnd: number;      // offsets into referenceText; UI renders from these only
  heard: string | null;                    // null = omitted; a sensitive heard token is replaced by null
  score: number; status: WordScoreStatus; trapIds: TrapId[]; tipFr?: string;
  startSec?: number; endSec?: number;
}
export interface PronunciationScoreRequest { referenceText: string; transcript: Transcript; level?: CEFRLevel }
export interface TrapCount { trapId: TrapId; errors: number; attempts: number }
export interface PronunciationReport {
  referenceText: string; words: WordScore[];
  overall: number | null;                  // null when deletions exceed SCORE_THRESHOLDS.maxDeletionRatio
  primaryTip: { wordIndex: number; trapId: TrapId; tipFr: string } | null;
  trapCounts: TrapCount[];
}

// ───────── Levels, modes, content ─────────
export interface Hint { id: string; en: string; fr: string; explanationFr: string }
export type HintTriple = readonly [Hint, Hint, Hint];
export interface Scenario {
  id: ScenarioId; titleEn: string; titleFr: string; levels: readonly CEFRLevel[];
  aiRoleEn: string; settingFr: string; userGoalFr: string; openingLineEn: string;
  hints: ReadonlyArray<{ level: CEFRLevel; hints: HintTriple }>;
}
export interface ShadowingItem { id: string; level: CEFRLevel; textEn: string; translationFr: string; targetTraps: TrapId[]; audioUrl?: string }
export interface Idiom { id: string; en: string; meaningFr: string; exampleEn: string; level: CEFRLevel }
export interface DebateTopic { id: string; level: CEFRLevel; motionEn: string; motionFr: string; idiomIds: string[] }
export interface RephraseFeedback { original: string; native: string; explanationFr: string; tags: FeedbackTag[] }
export interface DebateFeedback {
  items: RephraseFeedback[]; idiomsUsed: string[]; idiomsToTry: string[]; summaryFr: string;
  codeSwitchCards: SideCard[];             // filled server-side via analyzeCodeSwitch over userTurns
}
export type PlacementQuestion =
  | { id: string; level: CEFRLevel; kind: 'choice'; promptEn: string; promptFr?: string; options: readonly string[]; correctIndex: number }
  | { id: string; level: CEFRLevel; kind: 'speak'; promptEn: string; promptFr?: string; referenceText: string };
export type PlacementAnswer =
  | { questionId: string; kind: 'choice'; choiceIndex: number }
  | { questionId: string; kind: 'speak'; spokenScore: number }
  | { questionId: string; kind: 'dont_know' };
export interface PlacementResult {
  level: CEFRLevel; accuracyByLevel: Record<CEFRLevel, number | null>;
  confidence: 'low' | 'medium' | 'high'; method: 'quiz' | 'self_select';
}

// ───────── Drills and SRS ─────────
export interface DrillItem {
  id: string; level: CEFRLevel; promptFr: string; literalTrapEn: string; correctEn: string;
  acceptedEn: readonly string[];           // ≥ 4, incl. contractions and digit forms
  trapPatterns: readonly string[]; explanationFr: string; tags: readonly string[];
}
export interface SrsCard {
  itemId: string; ease: number; intervalDays: number; repetitions: number; lapses: number;
  dueAt: EpochMs; lastReviewedAt: EpochMs | null;
}
export type DrillVerdict = 'correct' | 'incorrect' | 'confirm';  // 'confirm' → « Tu as dit : … ? »
export interface DrillCheckResult { verdict: DrillVerdict; correct: boolean; matchedTrap: boolean; normalizedAnswer: string; expected: string; feedbackFr: string }
export interface DrillAttempt {
  id: string;                              // client UUID
  itemId: string; answer: string | null;   // null for spoken / self-check input
  correct: boolean; grade: ReviewGrade; durationMs: number; inputMode: InputMode; answeredAt: EpochMs;
}
export interface DailySet { dateKey: string; itemIds: string[]; budgetSec: number; newCount: number; reviewCount: number }

// ───────── Chat and TTS (HTTP contract) ─────────
export interface ChatMessage { role: ChatRole; content: string }
export type ChatRequest =
  | { action: 'reply'; mode: 'roleplay'; level: CEFRLevel; scenarioId: ScenarioId; messages: ChatMessage[] }
  | { action: 'reply'; mode: 'debate'; level: CEFRLevel; topicId: string; messages: ChatMessage[] }
  | { action: 'debate_feedback'; level: CEFRLevel; topicId: string; userTurns: string[] };
export type ChatResponse =
  | { action: 'reply'; reply: string; codeSwitch: CodeSwitchAnalysis | null }
  | { action: 'debate_feedback'; feedback: DebateFeedback };
export interface TtsQuery { catalog: TtsCatalog; id: string }           // GET /api/tts?catalog=&id=[&timings=1]
export interface TtsTimings { catalog: TtsCatalog; id: string; words: TranscriptWord[]; durationSec: number }

// ───────── Profile, progress, privacy ─────────
export interface ProfileSettings {
  captionsOn: boolean;
  playbackRate: PlaybackRate;              // default SHADOWING_PLAYBACK_RATE
  textAnswerMode: boolean;                 // type instead of speak on every practice screen
  sideCardAutoCollapse: boolean;           // false disables the ~6 s timeout
  silenceAnnouncementsWhileRecording: boolean;
}
export interface ConsentRecord { version: string; acceptedAt: EpochMs }
export interface Profile {
  level: CEFRLevel | null; nativeLang: 'fr'; ageBand: AgeBand | null;
  consent: ConsentRecord | null;           // mic features require consent.version === PRIVACY_CONSENT_VERSION
  settings: ProfileSettings;
}
export interface VocabularyEntry { term: string; frenchTerm: string | null; source: VocabSource; mastery: number; seenCount: number; saved: boolean; lastSeenAt: EpochMs }
export interface WeakPhoneme { trapId: TrapId; errorCount: number; attemptCount: number; lastSeenAt: EpochMs }
export interface SessionSummary {
  id: string; kind: SessionKind; level: CEFRLevel; scenarioId: ScenarioId | null; topicId: string | null;
  startedAt: EpochMs; endedAt: EpochMs; wordsSpoken: number; codeSwitchCount: number; pronunciationAvg: number | null;
}
export interface ProgressSnapshot {
  profile: Profile; vocabulary: VocabularyEntry[]; weakPhonemes: WeakPhoneme[];
  recentSessions: SessionSummary[];        // last 20
  srsCards: SrsCard[]; streakDays: number;
}
interface EventBase { eventId: string }    // client UUID, idempotency key (processed_events)
export type ProgressEvent =
  | (EventBase & { type: 'level_set'; level: CEFRLevel })
  | (EventBase & { type: 'settings_updated'; settings: Partial<ProfileSettings> })
  | (EventBase & { type: 'session_completed'; session: SessionSummary })
  | (EventBase & { type: 'drill_attempt'; attempt: DrillAttempt; card: SrsCard })
  | (EventBase & { type: 'pronunciation_report'; trapCounts: TrapCount[] })   // SERVER-PRODUCED ONLY; rejected from clients
  | (EventBase & { type: 'franglais_saved'; frenchTerm: string; englishTerm: string })
  | (EventBase & { type: 'vocab_result'; term: string; correct: boolean });
export type ClientProgressEvent = Exclude<ProgressEvent, { type: 'pronunciation_report' }>;
export type PrivacyRequest =
  | { action: 'accept_consent'; version: string; ageBand: AgeBand }
  | { action: 'delete_account'; confirm: 'SUPPRIMER' };
export interface PrivacyExport {
  exportedAt: EpochMs; profile: Profile; sessions: SessionSummary[]; vocabulary: VocabularyEntry[];
  weakPhonemes: WeakPhoneme[]; drillAttempts: DrillAttempt[]; srsCards: SrsCard[]; consents: ConsentRecord[];
}

// ───────── Ports (fakes in src/lib/ports, real adapters in src/server/adapters) ─────────
export interface AudioInput { bytes: Uint8Array; mimeType: AllowedAudioMime; filename: string }
export interface TranscribeOptions { purpose: TranscribePurpose }   // adapter derives language/prompt from purpose
export interface Transcriber { transcribe(audio: AudioInput, opts: TranscribeOptions): Promise<Result<Transcript & { noSpeechProb: number }>> }
export interface ChatCompletionRequest { system: string; messages: ChatMessage[]; maxTokens: number; temperature?: number; responseFormat?: 'text' | 'json' }
export interface ChatModel { complete(req: ChatCompletionRequest): Promise<Result<string>> }
export interface SpeechSynthesizer { synthesize(text: string, opts: { voice: string }): Promise<Result<Uint8Array>> }
export interface TtsCache { get(key: string): Promise<Uint8Array | null>; set(key: string, bytes: Uint8Array): Promise<void> }
export interface AuthContext { userId: UserId; accessToken: string }
export interface AuthVerifier { verify(authorizationHeader: string | null, nowMs: EpochMs): Promise<Result<AuthContext>> }
export interface ProgressStore {
  getSnapshot(auth: AuthContext, opts: { tzOffsetMin: number }): Promise<Result<ProgressSnapshot>>;
  record(auth: AuthContext, event: ProgressEvent): Promise<Result<null>>;
}
export interface PrivacyStore {
  acceptConsent(auth: AuthContext, version: string, ageBand: AgeBand): Promise<Result<null>>;
  exportAll(auth: AuthContext): Promise<Result<PrivacyExport>>;
  deleteAccount(auth: AuthContext): Promise<Result<null>>;
}
export interface RateLimitDecision { allowed: boolean; remaining: number; retryAfterSec: number }
export interface RateLimiter { take(scope: 'ip' | 'user', key: string, route: RateLimitedRoute, nowMs: EpochMs): RateLimitDecision }
export interface Clock { now(): EpochMs }
export interface ServerDeps {
  transcriber: Transcriber; chat: ChatModel; tts: SpeechSynthesizer; ttsCache: TtsCache;
  auth: AuthVerifier; progress: ProgressStore; privacy: PrivacyStore; limiter: RateLimiter; clock: Clock;
  clientIp: (req: Request) => string | null;   // x-real-ip, else trusted hop of x-forwarded-for; null skips IP bucket
  allowedOrigins: readonly string[]; ttsVoice: string;
}
```

Semantics the contract cannot express (binding on owners):

- **SQL check lists.** `TRAP_IDS`, `SESSION_KINDS`, `REVIEW_GRADES`, `VOCAB_SOURCES`, `INPUT_MODES`, `AGE_BANDS` and `CEFR_LEVELS` must each equal the corresponding SQL `check (… in (…))` list. G's `migration.test.ts` asserts this.
- **Server-only event.** `pronunciation_report` is produced only by the server. `parseProgressEvent` returns `ClientProgressEvent` and rejects that type.
- **No-speech responses.** `TranscribeResponse.status = 'no_speech'` means no progress is recorded, no weak-phoneme writes happen and no `allFrench` nudge is shown.
- **Sensitive tokens.** `WordScore.heard` is `null` when the heard token is a sensitive word. The UI then shows only the expected word and the tip.

---
## 6. Module public APIs (signature contract for soft dependencies)

Each lib directory exposes an `index.ts` re-exporting exactly these. Internals are free.

| Module (owner) | Exports |
|---|---|
| `src/lib/pronunciation/index.ts` (B) | `TRAPS: readonly PronunciationTrap[]` · `getTrap(id: TrapId)` · `trapsInWord(word: string): TrapId[]` · `tokenizeWithOffsets(text: string): Array<{ token: string; start: number; end: number }>` · `isSensitiveWord(w: string): boolean` · `scorePronunciation(req: PronunciationScoreRequest): PronunciationReport` · `tipFor(trapId: TrapId, word: string): string` · `MOUTH_DIAGRAMS: Readonly<Record<TrapCategory, { viewBox: string; paths: readonly string[]; altFr: string; altEn: string }>>` |
| `src/lib/codeswitch/index.ts` (C) | `FR_LEXICON` · `EN_FALSE_FRIENDS: readonly { en: string; frMeaning: string; noteFr: string }[]` · `UNTRANSLATABLE: readonly string[]` · `detectFrench(utterance: string, opts?: { ignoredTerms?: readonly string[] }): DetectedSpan[]` · `buildSideCards(utterance: string, spans: DetectedSpan[]): SideCard[]` · `analyzeCodeSwitch(utterance: string, opts?: { ignoredTerms?: readonly string[] }): CodeSwitchAnalysis` · `isHallucination(text: string): boolean` |
| `src/lib/drills/index.ts` (D) | `DRILL_ITEMS` · `getDrill(id)` · `normalizeAnswer(s)` · `checkAnswer(item: DrillItem, answer: string, inputMode: InputMode): DrillCheckResult` · `buildDailySet(cards, items, nowMs, opts?: { budgetSec?: number /*120*/; secondsPerItem?: number /*16*/; newPerDay?: number /*fills budget on day 1*/; level?: CEFRLevel; tzOffsetMin?: number }): DailySet` |
| `src/lib/srs/index.ts` (D) | `newCard` · `review(card, grade, nowMs)` · `isDue` · `gradeFromResult(r: DrillCheckResult, durationMs: number): ReviewGrade` |
| `src/lib/progress/index.ts` (D) | `computeStreak(sessionEndTimes: readonly EpochMs[], nowMs, tzOffsetMin): number` · `masteryAfter(prev: number, correct: boolean): number` (uses `MASTERY_EMA_ALPHA`) |
| `src/lib/levels/index.ts` (E) | `levelIndex` · `PLACEMENT_QUESTIONS` · `PLACEMENT_TRANSITIONS` · `nextPlacementQuestion(answers, opts: { speakAllowed: boolean }): PlacementQuestion \| null` · `scorePlacement(answers): PlacementResult` · `selfSelectPlacement(level: CEFRLevel): PlacementResult` · `SCENARIOS` · `getScenario(id)` · `hintsFor(id, level): HintTriple` · `getHint(id: string): Hint \| undefined` · `SHADOWING_ITEMS` · `shadowingFor(level)` · `IDIOMS` · `DEBATE_TOPICS` · `getTopic(id)` · `defaultModeFor(level)` · `scaffoldingFor(level)` · `parseDebateFeedback(raw: string): Result<Omit<DebateFeedback, 'codeSwitchCards'>>` |
| `src/lib/db/index.ts` (G) | `TABLES` · `RPC = { recordDrillAttempt: 'record_drill_attempt', recordVocab: 'record_vocab', incrementWeakPhonemes: 'increment_weak_phonemes', recordEvent: 'record_event', deleteMyAccount: 'delete_my_account' } as const` · row types · mappers (`fromProfileRow`, `toSessionRow`/`fromSessionRow`, `fromSrsRow`, `fromVocabRow`, `fromWeakPhonemeRow`, `fromDrillAttemptRow`). F imports **only** from this index. |
| `src/lib/ports/index.ts` (F) | port types re-export · `createFakeTranscriber`, `createFakeChatModel`, `createFakeSynthesizer`, `createMemoryTtsCache`, `createFakeAuth`, `createInMemoryProgressStore`, `createInMemoryPrivacyStore`, `createFixedClock` |
| `src/server/handlers/*.ts` (F) | `handleTranscribe`, `handleChat`, `handleTts`, `handleProgressGet`, `handleProgressPost`, `handlePrivacyGet`, `handlePrivacyPost`: all `(req: Request, deps: ServerDeps) => Promise<Response>` |
| `src/lib/ui/index.ts` (H1) | `STRINGS` / `t(key, mode: 'fr' \| 'bi' \| 'en')` · `tokenizeForHighlight` · `activeIndexAtTime` · `activeIndexAtChar` · `sessionReducer` · `errorLadderReducer` · `sideCardQueueReducer` · `outboxReducer` · `recorderGate(stats: { durationSec: number; rms: number; peak: number }): 'ok' \| 'too_short' \| 'silent'` · `pickRecorderMime` |
| `src/lib/pwa/index.ts` (A) | `micPermissionReducer` · `mapGetUserMediaError` · `detectInstallContext` · `MIC_COPY` (from `copy.ts`) |

---
## 7. Detailed work units

Rules for every unit:

- Acceptance includes "its verification commands pass [HERE]" and "tsc clean [HERE]".
- Tests use `node:test` + `node:assert/strict`.
- Expected values are written by hand.
- Performance assertions use a 200 ms bound, or are benchmark-only (logged, not asserted).

### 7.0 File ownership summary

| Unit | Owns (exclusive) |
|---|---|
| 0 | `package.json`, `tsconfig.lib.json`, `src/lib/types.ts`, `src/lib/types.test.ts` |
| A | `next.config.ts`, `tsconfig.json`, `next-env.d.ts`, `.gitignore`, `.env.example`, `app/layout.tsx`, `app/offline/page.tsx`, `app/not-found.tsx`, `public/manifest.webmanifest`, `public/sw.js`, `public/icons/*`, `src/components/pwa/{SwRegister,InstallPrompt,MicPermissionGate}.tsx`, `src/lib/pwa/{index,micPermission,installPrompt,copy}.ts` + `{micPermission,installPrompt,sw}.test.ts`, `scripts/{gen-icons,gen-precache,check-boundaries,check-routes,check-docs}.mjs`, `scripts/check-boundaries.test.ts` |
| B | `src/lib/pronunciation/{index,traps,lexicon,sensitive,tokenize,align,scorer,tips,diagrams}.ts` + `{traps,tokenize,align,scorer,tips,diagrams,sensitive}.test.ts`, `src/lib/pronunciation/fixtures/synthetic/*.json`, `src/lib/pronunciation/fixtures/real/README.md` (clips added at calibration) |
| C | `src/lib/codeswitch/{index,lexicon,allowlist,enFalseFriends,untranslatable,hallucinations,normalize,detector,sidecards}.ts` + `{detector,sidecards,lexicon,hallucinations}.test.ts`, `src/lib/codeswitch/fixtures/whisper-style.json` |
| D | `src/lib/drills/{index,catalog,normalize,checker,dailySet}.ts` + tests; `src/lib/srs/{index,scheduler}.ts` + test; `src/lib/progress/{index,streak,mastery}.ts` + tests |
| E | `src/lib/levels/{index,cefr,placement,placementQuestions,scenarios,shadowing,debate,idioms,feedback,scaffolding}.ts` + `{placement,scenarios,shadowing,feedback,scaffolding,content}.test.ts` |
| F | `src/lib/security/{validate,rateLimit,origin,audio,sanitize,jwt,clientIp}.ts` + tests; `src/lib/prompts/{tutor,debateFeedback,transcribe}.ts` + tests; `src/lib/ports/{index,fakes}.ts` + `fakes.test.ts`; `src/server/{env,deps,http,fetchJson}.ts`; `src/server/adapters/{openaiTranscriber,openaiTts,anthropicChat,openaiChat,supabaseAuth,supabaseProgress,supabasePrivacy,memoryTtsCache}.ts` + tests; `src/server/handlers/{common,transcribe,chat,tts,progress,privacy}.ts` + tests; `src/server/fixtures/*`; `app/api/{transcribe,chat,tts,progress,privacy}/route.ts` |
| G | `supabase/migrations/20261121000000_init.sql`, `supabase/config.toml`, `supabase/tests/{00_auth_stub.sql,rls.sql,run-local.sh}`, `src/lib/db/{index,columns,mappers}.ts` + `{columns,mappers,migration}.test.ts` |
| H1 | `src/lib/ui/{index,strings,highlight,sessionMachine,errorLadder,sideCardQueue,outbox,localStoreReducers,recorderGate,recorderMime}.ts` + tests; `src/client/{api,auth,recorder,tts,localStore,sync,events}.ts` |
| H2 | `app/(app)/{layout,page}.tsx`, `app/(app)/{practice,pronunciation,progress,settings,privacy}/page.tsx`, `app/(session)/layout.tsx`, `app/(session)/practice/shadowing/page.tsx`, `app/(session)/drills/page.tsx`, `app/(onboarding)/{layout.tsx,onboarding/page.tsx,sign-in/page.tsx}`, `src/components/core/**` (AppTabBar, MicButton, LiveTranscript, WordHighlight, HighlightLegend, ShadowingPlayer, PronunciationResult, TrapCard, MouthDiagram, DrillRunner, PlacementQuiz, ErrorLadder, OfflineBanner, LevelBadge, TextAnswerInput, ConsentSheet, AgeGate) + `*.module.css` |
| H3 | `app/(session)/practice/roleplay/page.tsx`, `app/(session)/practice/debate/page.tsx`, `src/components/conversation/**` (SideCard, SideCardStack, HintChips, ScenarioPicker, TopicPicker, ChatTranscript, DebateFeedbackView) + `*.module.css` |
| I | `README.md`, `docs/SECURITY.md`, `docs/MANUAL_QA.md` |

### Unit 0: Shared contract and tooling base (one agent, first, about 30 min)

**Owns:** see §7.0.

1. Write `src/lib/types.ts` exactly as in §5.
2. Write `package.json`:
   - `"type": "module"`, `"private": true`, `engines.node >=22.6`.
   - Scripts:
     - `dev`/`build`/`start`: `next …`.
     - `postbuild`: `node scripts/gen-precache.mjs`.
     - `test`: `node --experimental-strip-types --test 'src/**/*.test.ts' 'scripts/**/*.test.ts'`.
     - `typecheck:lib`: `tsc -p tsconfig.lib.json`.
     - `typecheck`: `tsc --noEmit`.
     - `check`: `node scripts/check-boundaries.mjs && node scripts/check-routes.mjs && node scripts/check-docs.mjs`.
     - `db:test`: `bash supabase/tests/run-local.sh`.
   - Deps: `next@^15`, `react@^19`, `react-dom@^19`. There is no Supabase SDK.
   - DevDeps: `typescript@^5.8`, `@types/node@^22`, `@types/react@^19`, `@types/react-dom@^19`.
3. Write `tsconfig.lib.json`:
   - `strict`, `noEmit`, ES2023 + DOM + DOM.Iterable, NodeNext.
   - `allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `types: ["node"]`.
   - `include`: `src/lib/**/*.ts`, `src/server/**/*.ts`, `src/client/**/*.ts`, `scripts/**/*.ts`.
4. Write `types.test.ts`:
   - `CEFR_LEVELS` order;
   - `LIMITS.maxAudioBytes === 4194304`;
   - `isAllowedAudioMime('audio/webm') === true` and `isAllowedAudioMime('text/plain') === false`;
   - `TRAP_DEEPLINK` values are all in `TRAP_CATEGORIES`;
   - `RATE_LIMITS` keys are exactly `transcribe, chat, tts, progress, privacy`;
   - the runtime export count is 26.

**Verify [HERE]:** `node --experimental-strip-types --test src/lib/types.test.ts` and `tsc -p tsconfig.lib.json --typeRoots /opt/npm-tools/node_modules/@types`.

**Acceptance [HERE]:**
- `grep -c '^export' src/lib/types.ts` is 115.
- The tests pass and tsc reports 0 errors.
- After sign-off the contract is frozen to additive changes.

### Unit A: Project scaffold, PWA, checkers

**Owns:** see §7.0.

1. **`next.config.ts`**
   - `reactStrictMode`, `poweredByHeader: false`.
   - `headers()` on all routes:
     - **Production CSP:** `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ${NEXT_PUBLIC_SUPABASE_URL}; media-src 'self' blob:; img-src 'self' data: blob:; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`.
     - **Development CSP** adds `'unsafe-eval'` to `script-src`.
     - `Permissions-Policy: microphone=(self), camera=(), geolocation=()`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`.
   - `/sw.js` gets `Cache-Control: no-cache`. There is no `Service-Worker-Allowed` header.
   - No OpenAI origin is in `connect-src`: v1 has no browser-to-OpenAI traffic.
2. **`app/layout.tsx`**
   - Imports `../src/styles/tokens.css` and `../src/styles/globals.css`.
   - `metadata` (manifest, appleWebApp, icons) and `viewport` (themeColor, `viewportFit: cover`).
   - `<html lang="fr">`, renders `<SwRegister/>` + children.
3. **`public/manifest.webmanifest`**
   - `start_url: "/?source=pwa"`, `display: standalone`, `lang: fr`.
   - 192/512 + maskable icons.
   - Shortcuts: `/drills`, `/practice/shadowing`.
4. **`scripts/gen-precache.mjs`** (runs at `postbuild`)
   - Reads `.next/build-manifest.json` and `.next/app-build-manifest.json`, and writes the `PRECACHE` array into `public/sw.js` between `/*PRECACHE_START*/…/*PRECACHE_END*/` markers.
   - The array holds the app-shell `/_next/static/**` chunks for `/`, `/offline`, `/drills`, `/practice/shadowing`, `/pronunciation`, plus those pages, the manifest and the icons.
   - It never includes redirecting URLs: `/?source=pwa` is not precached, and the navigation fallback uses `ignoreSearch`.
   - The dev default list is pages only.
5. **`public/sw.js`** (plain JS, `CACHE_VERSION`)
   - Install: `addAll`-tolerant per URL, so one failure doesn't abort the install.
   - Fetch routing:
     - (a) `/api/*` → network-only;
     - (b) RSC requests (`RSC: 1` header or `_rsc` param) → network-only;
     - (c) `/_next/static/*` and `/icons/*` → cache-first;
     - (d) navigations → network-first with a 3 s timeout, then `cache.match(req, { ignoreSearch: true })`, then `/offline`;
     - (e) other same-origin GET → stale-while-revalidate.
   - Never cache `response.redirected`, `status !== 200` or `type === 'opaque'`.
   - Activate: delete old caches, `clients.claim()`. `SKIP_WAITING` message.
6. **`SwRegister.tsx`**: registers in production. On a waiting worker it dispatches `window.dispatchEvent(new CustomEvent('pts:sw-update'))`; H2's `OfflineBanner` listens.
   **`InstallPrompt.tsx`** + `installPrompt.ts` (`detectInstallContext`).
7. **Mic permission**
   - `micPermission.ts` reducer. States: `unknown|prompt|requesting|granted|denied|unavailable|in_use|insecure`.
   - `mapGetUserMediaError` handles `NotAllowedError`, `NotFoundError`, `NotReadableError`, `SecurityError`, `OverconstrainedError`.
   - `copy.ts` exports `MIC_COPY` (the FR/EN strings from design 04 §7); H imports it.
   - `MicPermissionGate.tsx` offers a text-mode fallback on denial.
8. **`scripts/check-boundaries.mjs`** (no dependencies; exit 1 with `file:line`). Rules:

   | Rule | What it checks |
   |---|---|
   | 1 | A `'use client'` file, or anything in `src/client/**` or `src/components/**`, imports `src/server/` or reads a non-`NEXT_PUBLIC_*` `process.env`. |
   | 1b | **Transitive import closure** from those roots: nothing reaches `src/server/**` or `src/lib/prompts/**`. |
   | 2 | No `NEXT_PUBLIC_*` name contains `SECRET`, `SERVICE`, `OPENAI` or `ANTHROPIC`. |
   | 3 | Non-test `src/lib/**` has no bare specifiers and no `node:*`. Tests may import any `node:*`. Relative imports end in `.ts`. No `enum `, `namespace ` or parameter properties. |
   | 3b | No `src/lib` import resolves into `src/server`, `src/client`, `src/components` or `app`. |
   | 3c | Non-test `src/lib/**` has no `process.`, `Buffer`, `require(` or `__dirname`. |
   | 4 | No `dangerouslySetInnerHTML`. |
   | 5 | Every `app/api/**/route.ts` has the literal `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`, and imports from `src/server/handlers/`. |
   | 6 | The `/api/` and RSC branches in `sw.js` return `fetch(` directly. |
   | 7 | No package imports `@supabase/supabase-js`, `openai` or `@anthropic-ai/sdk`. |
   | 8 | Hex colours appear only in CSS outside `*.module.css` and SVG attributes: no `#rgb`/`#rrggbb` inside `style={{…}}` or `*.module.css`. |
   | 9 | `src/components/core/MicButton.tsx` contains no `aria-pressed` (design 05). |
   | 10 | JSX text nodes in `app/**` and `src/components/**` contain no French diacritics; copy must come from `STRINGS`. |

9. **`scripts/check-routes.mjs`**: asserts that every route in design 02 §4, plus `/privacy`, `/sign-in` and `/offline`, maps to an existing `page.tsx`, and that the 5 API route files exist.
   **`scripts/check-docs.mjs`**: every var in `.env.example` appears in `README.md`.
10. **`scripts/gen-icons.mjs`**: uses the global sharp. If that fails, it is a [MANUAL] step.

**Verify [HERE]:**

```bash
node --experimental-strip-types --test 'src/lib/pwa/**/*.test.ts' scripts/check-boundaries.test.ts
node scripts/check-boundaries.mjs && node scripts/check-routes.mjs
node -e "JSON.parse(require('fs').readFileSync('public/manifest.webmanifest','utf8'))"
```

**Acceptance:**
- [HERE] `sw.test.ts` (loads `public/sw.js` in `node:vm` with fake `self`/`caches`/`fetch`) asserts:
  - install precaches the list and tolerates one 404;
  - `/api/chat` is never `cache.put`;
  - RSC is never cached;
  - redirected and 500 responses are never cached;
  - offline `/?source=pwa` returns the cached `/`;
  - an offline unknown page returns `/offline`;
  - activate deletes old caches.
- [HERE] The mic reducer covers all states and error names.
- [HERE] Every check-boundaries rule has a violating fixture and a clean fixture, including the transitive closure (1b) through a 2-hop import.
- [HERE] The manifest is valid JSON with the required fields.
- [MANUAL] Install prompt on Android, iOS instructions, and the CSP not breaking `next dev`/`next start` (MANUAL_QA §PWA).

### Unit B: Pronunciation intelligibility check (`src/lib/pronunciation/**`)

**Owns:** see §7.0.

Approach. The only signal is ASR text plus a coarse confidence, so this is an **intelligibility check**, not a pronunciation grader, and it is labelled that way in the UI and README (with a limitations section). Stress cannot be detected from text, so `stress_misplaced` and `weak_forms` exist only as **practice content** (catalog, minimal pairs, diagrams). The scorer never emits them.

1. **`traps.ts`**: the catalog of all 11 `TRAP_IDS`, each with French `titleFr`/`explanationFr`/`mouthTipFr`, IPA and at least 3 minimal pairs.
   - Pairs: think/sink, thing/sing, three/free, this/zis, they/day; ship/sheep, live/leave, sit/seat, full/fool; hair/air, heat/eat, hat/at, heart/art, inserted H ("an hour"); stress: PHOto/phoTOgraphy, deVELop, COMfortable, hoTEL, eCOnomy.
   - **beach/bitch** is `{ target: 'beach', confusedWith: <rude word>, sensitive: true }`. Only "beach" is ever a target.
2. **`sensitive.ts`**: `isSensitiveWord`, a small list that includes the rude counterpart. It is used by:
   - the scorer: if the heard token is sensitive, `heard = null` and only the expected word and tip are shown;
   - B's own catalog test;
   - D, E and F tests (they import it to assert exclusion).
3. **`lexicon.ts`**: word → `TrapId[]` for about 120 practice words, none of them sensitive.
4. **`tokenize.ts`**: `tokenizeWithOffsets` (lowercase key, original char offsets, apostrophes kept).
5. **`align.ts`**: word-level Levenshtein between reference tokens and `TranscriptWord[]`.
6. **`scorer.ts`**:
   - A missing confidence is treated as `SCORE_THRESHOLDS.defaultConfidence` (0.75). Such a word is never `unsure` and never `ok` at 100.
   - A match scores `round(100 × confidence)`.
   - Confidence < 0.5 → `unsure`, excluded from `overall`.
   - A known-confusion substitution (minimal pairs, or the rules `th→s/f/t`, `th→z/d`, dropped initial `h`, `ee↔i`, `oo↔u`):
     - for a reference of ≤ 2 tokens (isolated word or minimal pair): score 40, `error`, plus the trap;
     - in sentence shadowing: score 60, `warn`, plus the trap. **Never `error`.**
   - Another substitution with edit distance ≤ 1: 65, `warn`. A deletion: 0, `error` for isolated words, `warn` in sentences.
   - If deletions exceed 60% of the reference tokens: `overall: null`, every word `unsure`, `primaryTip: null`.
   - `charStart`/`charEnd` come from `tokenizeWithOffsets(referenceText)`.
   - `primaryTip`: one tip; category order th > h > vowel.
   - `trapCounts` counts only the scoreable traps.
7. **`tips.ts`**: word-specialised French tips. **`diagrams.ts`**: `MOUTH_DIAGRAMS` for the 4 categories (inline SVG `viewBox` + path data + `altFr`/`altEn` describing tongue, teeth and lips).
8. **Fixtures:**
   - `fixtures/synthetic/*.json` are hand-written Whisper-style `verbose_json` samples. They are documented as synthetic.
   - `fixtures/real/README.md` describes the [MANUAL] calibration milestone (about 20 clips).

**Verify [HERE]:** `node --experimental-strip-types --test 'src/lib/pronunciation/**/*.test.ts'` and tsc.

**Acceptance [HERE]:**
- "think" vs heard "sink" (isolated) → `error` with `th_as_s`.
- "I think so" / "I sink so" → word 1 `warn` with `th_as_s`, not `error`.
- "this is my ship" / "zis is my sheep" → `dh_as_z` and `ih_vs_iy` warns; the tip is on "zis".
- A word with undefined confidence is not `unsure` and scores ≤ 80.
- 3 of 4 words deleted → `overall === null` and all words `unsure`.
- A heard sensitive token → `heard === null`.
- No sensitive word appears in any `practiceWords` or lexicon key.
- The scorer never returns `stress_misplaced`/`weak_forms` across all fixtures.
- `charStart`/`charEnd` slice `referenceText` back to the original word, including punctuation and apostrophes.
- The diagrams have non-empty `altFr`/`altEn` for all 4 categories.
- The catalog has 11 ids, each with ≥ 3 pairs and non-empty French fields.

[MANUAL] Calibration: on about 20 real French-accented clips, the scorer flags at least N known errors (N is set at calibration; MANUAL_QA §Calibration).

### Unit C: Code-switch detector (`src/lib/codeswitch/**`)

**Owns:** see §7.0.

Detection is **best-effort**: Whisper may anglicise or translate French words. The transcription prompt (F) mitigates this, and the false-friend lists catch the leftovers.

1. **`lexicon.ts`**: at least 150 entries:
   - nouns: embouteillage→traffic jam, boulangerie→bakery, réunion→meeting, entretien→interview;
   - phrases: du coup→so, en fait→actually, c'est-à-dire→I mean, je sais pas→I don't know;
   - fillers: euh, bref, genre (filler sense only);
   - false friends: actuellement→currently, éventuellement→possibly, librairie→bookshop.
2. **`allowlist.ts`**:
   - (a) loanwords: croissant, café, déjà vu, rendez-vous, cliché, résumé, ballet;
   - (b) English homographs: pain, chat, coin, four, car, plus, sale, son, main, sort, attend, place. **`rester` is removed** (it is not English).
   - (c) proper nouns: capitalised mid-sentence tokens.
   - `genre` conflict resolved: "genre" as a noun after a determiner ("a genre", "the genre", "music genre") is allowed. "genre" adjacent to a clause boundary or a verb ("it was genre crazy", "genre I went") is a filler. This **does not depend on commas**, since Whisper punctuation is unreliable.
3. **`enFalseFriends.ts`**: English words French speakers misuse (actually, eventually, assist, library, sensible, deception, sympathetic, achieve, attend). F feeds them into the tutor prompt and the debate-feedback prompt.
4. **`untranslatable.ts`**: words such as machin, truc, bidule. Detected → `needsClarification`, no card.
5. **`hallucinations.ts`**: `isHallucination(text)` is a normalised denylist of known Whisper silence hallucinations: "Sous-titres réalisés par la communauté d'Amara.org", "Merci d'avoir regardé", "Sous-titrage ST' 501", "Thanks for watching", "Subtitles by the Amara.org community", and repeated "...". It is exact or contained after normalisation.
6. **`normalize.ts`**: NFC plus apostrophe folding, keeping an **index map back to the original string**. All `DetectedSpan`/`SideCard.span` offsets refer to the original, un-normalised input.
7. **`detector.ts`**:
   - Confidence by match type: phrase 0.95, lexicon word 0.85, diacritic 0.75, morphology 0.6 (`-ement`, `-eux`, `-oire`, elisions `l'`/`d'`/`j'`/`qu'`).
   - Homographs are flagged only next to another French span.
   - `opts.ignoredTerms` (the per-user "Ce n'est pas du français" list, stored client-side by H1) suppresses matches.
8. **`sidecards.ts`**: unchanged rules: at most 3 cards, sorted by confidence; < 0.7 or no lexicon entry → `needsClarification`.

**Verify [HERE]:** `node --experimental-strip-types --test 'src/lib/codeswitch/**/*.test.ts'` and tsc.

**Acceptance [HERE]:**
- The revision-1 cases still pass: embouteillage, pain, croissant, du coup, Actuellement/Lyon, je sais pas (`allFrench`), machin (`needsClarification`).
- `"music genre"` → no card; `"it was genre crazy"` → filler card (no commas).
- Decomposed-accent input → spans whose offsets slice the **original** string to the French word.
- `ignoredTerms: ['boulangerie']` suppresses that card.
- `isHallucination` is true for each denylist phrase, including case and punctuation variants, and false for "Thanks for the coffee".
- `fixtures/whisper-style.json` holds at least 10 realistic Whisper outputs (odd casing, missing punctuation, partially anglicised French), each with expected cards.
- A 2000-char input finishes in < 200 ms.

### Unit D: Drills, SRS, progress helpers

**Owns:** see §7.0.

1. **`catalog.ts`**: the 22 items below.

   | # | French | Trap (wrong) | Correct |
   |---|---|---|---|
   | 1 | J'ai 25 ans | I have 25 years | I am 25 |
   | 2 | Je suis d'accord | I am agree | I agree |
   | 3 | J'habite ici depuis 3 ans | I live here since 3 years | I have lived here for 3 years |
   | 4 | J'ai faim | I have hunger | I'm hungry |
   | 5 | J'ai froid | I have cold | I'm cold |
   | 6 | Il y a deux ans | There is two years | Two years ago |
   | 7 | Je suis en train de manger | I am in train of eating | I'm eating |
   | 8 | Ça dépend de toi | It depends of you | It depends on you |
   | 9 | Tu me manques | You miss me | I miss you |
   | 10 | J'ai assisté à la réunion | I assisted the meeting | I attended the meeting |
   | 11 | Actuellement, je travaille à Paris | Actually, I work in Paris | Currently, I work in Paris |
   | 12 | Je viendrai éventuellement | I will eventually come | I might come |
   | 13 | Peux-tu m'expliquer ? | Can you explain me? | Can you explain it to me? |
   | 14 | Merci de m'aider | Thank you for help me | Thank you for helping me |
   | 15 | J'ai besoin de toi | I have need of you | I need you |
   | 16 | Faire une erreur | Do an error | Make a mistake |
   | 17 | Comment ça s'écrit ? | How it writes itself? | How do you spell it? |
   | 18 | Ça fait longtemps | It makes long time | It's been a long time |
   | 19 | Les informations sont fausses | The informations are false | The information is wrong |
   | 20 | Je n'ai rien dit | I didn't say nothing | I didn't say anything |
   | 21 | Il fait beau | It makes beautiful | The weather is nice |
   | 22 | Je me suis inscrit | I inscribed myself | I signed up |

   - Each item has `acceptedEn` ≥ 4, including contractions and digit forms. For #1: "I am 25", "I'm 25", "I am twenty-five", "I'm 25 years old".
   - Each item has at least 1 `trapPattern` and a French explanation.
   - No sensitive words.
2. **`normalize.ts`/`checker.ts`**, `checkAnswer(item, answer, inputMode)`:
   - Normalisation: lowercase, strip punctuation, expand contractions, digits ↔ number words, collapse whitespace.
   - Typed answers: `correct` if they equal an accepted form; otherwise `incorrect`, with `matchedTrap` from `trapPatterns`.
   - Spoken answers (ASR text):
     - `correct` if they hit an accepted form, **or** contain all of `correctEn`'s core tokens (stop-words removed) and no `trapPattern`;
     - `incorrect` if a trap pattern matches;
     - otherwise `verdict: 'confirm'`, with `feedbackFr: « Tu as dit : "<answer>" ? »` for user self-confirmation.
   - `self_check` input (offline or guest): the user marks it themselves, so the checker just returns the expected answer.
3. **`scheduler.ts`** (SM-2 variant):
   - Ease starts at 2.5, floor 1.3, cap 180 d.
   - `again`: reps 0, lapses +1, interval 10 min, ease −0.2.
   - `hard`: if `repetitions === 0` the interval is **0.5 d**, otherwise interval × 1.2; ease −0.15.
   - `good`: 1 d, then 3 d, then × ease.
   - `easy`: × ease × 1.3, ease +0.15.
   - `gradeFromResult`: incorrect → again; confirm → hard; correct and > 15 s → hard; correct and < 4 s → easy; otherwise good.
4. **`dailySet.ts`**:
   - `secondsPerItem` defaults to 16, so the 120 s budget gives 7 items.
   - Order: due reviews (most overdue first), then new items at or below the level, then the nearest-due items.
   - `newPerDay` defaults to filling the budget on day 1 (7 new when there are no cards), then 3 per day.
   - Pure and deterministic.
5. **`streak.ts`**: unchanged. **`mastery.ts`**: `masteryAfter(prev, correct) = prev + MASTERY_EMA_ALPHA × ((correct ? 1 : 0) − prev)`, clamped. G's SQL `record_vocab` uses the same formula.

**Verify [HERE]:** `node --experimental-strip-types --test 'src/lib/drills/**/*.test.ts' 'src/lib/srs/**/*.test.ts' 'src/lib/progress/**/*.test.ts'` and tsc.

**Acceptance [HERE]:**
- Typed "I'm 25.", "i am twenty-five" → correct. "I have 25 years" → incorrect with `matchedTrap`.
- Spoken "Yeah I am 25" → correct by core tokens. Spoken "I am twenty" → `confirm`.
- Realistic ASR inputs ("I Agree.", "i've lived here for three years") → correct.
- SRS good ×3 from t0 → 1, 3, 7.5 d. `hard` on a new card → 0.5 d. Ease never drops below 1.3 after 10 × `again`.
- Daily set: 0 cards → 7 new (fits 120 s at 16 s); 15 overdue → 7 reviews, most overdue first.
- `masteryAfter(0, true) === 0.3`. The streak is correct at UTC−5 and UTC+1.
- Catalog: 22 unique ids, the 3 brief items present, every item with `acceptedEn.length ≥ 4`, no sensitive word (`isSensitiveWord` from B).

### Unit E: Levels, placement, scenarios, shadowing, debate

**Owns:** see §7.0.

1. **`placementQuestions.ts`**: at least 3 choice questions per level (target errors of French speakers) and 1 speak question per level.
2. **`placement.ts`**: an adaptive quiz of **5 to 6 items maximum**, driven by `PLACEMENT_TRANSITIONS`, an explicit table.
   - Start at A2.
   - A correct answer moves up one level; a wrong answer or `dont_know` moves down one.
   - Stop after 6 items, or after 2 consecutive misses at the same level.
   - Fall back to A1 when the first two answers are wrong or `dont_know`.
   - `scorePlacement`: the level is the highest one with ≥ 0.6 accuracy, where all lower asked levels are also ≥ 0.6.
   - Confidence:
     - `high` needs ≥ 2 answers at the decided level, plus a miss at the level above (at C1, only C1 answers count, so 2 correct C1 answers give `high`);
     - `medium` needs ≥ 1 answer at the decided level;
     - otherwise `low`.
   - Speak items are weighted 0.5. They are skipped when `speakAllowed` is false (signed out, mic denied or offline).
   - `selfSelectPlacement(level)` returns `{method: 'self_select', confidence: 'low'}`.
3. **`scenarios.ts`**: 4 scenarios with hint triples (tiers A2, B1, B2). Each `Hint` has a stable `id`, used by the TTS catalog.
4. **`shadowing.ts`**: at least 3 items per level, no sensitive words. **`idioms.ts`**: at least 20 idioms. **`debate.ts`**: at least 6 topics, 2 of them at B1.
5. **`feedback.ts`**: `parseDebateFeedback(raw)`:
   - tolerates code fences and a missing leading `{` (Anthropic prefill);
   - validates the shape strictly (≤ 8 items, strings ≤ 400 chars, tags in `FEEDBACK_TAGS`);
   - returns `Result` with `{ok: false, error: {code: 'upstream_error', message}}`.
6. **`scaffolding.ts`**: unchanged (A1-A2 shadowing/FR/always; B1-B2 roleplay/bilingual/tap; C1 debate/EN/off, no live side-cards).

**Verify [HERE]:** `node --experimental-strip-types --test 'src/lib/levels/**/*.test.ts'` and tsc.

**Acceptance [HERE]:**
- All-correct → C1 within 6 items with `high` confidence (reachable).
- All-wrong → A1. All `dont_know` → A1.
- `speakAllowed: false` never returns a speak item.
- `hintsFor('cafe','C1')` → the B2 triple.
- `parseDebateFeedback` accepts fenced JSON and prefill-missing JSON, and rejects a missing `summaryFr` with `error.code === 'upstream_error'`.
- `content.test.ts`: minimum counts, non-empty French fields, unique hint ids, no sensitive words.
### Unit F: Security, prompts, ports, adapters, handlers, API routes

**Owns:** see §7.0.

Milestones:
- **F1** (security, prompts, ports and fakes) depends only on unit 0. Prompt and validation tests use **local fixtures** in `src/server/fixtures/`: a fake `Scenario`, `DebateTopic` and `DrillItem`. It does not import B through E.
- **F2** (adapters, handlers) imports B, C, D, E and G (`src/lib/db/index.ts` only). Its tests close once those land.

1. **`validate.ts`**: hand-written `unknown → Result<T>` parsers. Lookups are passed in as parameters, never imported:
   - `parseChatRequest(raw, { topicExists, now })`:
     - roles in `CHAT_ROLES`;
     - a message array longer than `chatHistoryWindow` is **truncated to the last 20**, not rejected;
     - each message ≤ `maxMessageChars`;
     - `debate_feedback` turns are ≤ `maxDebateTurns`, and their total length ≤ `maxDebateFeedbackChars`, else 400.
   - `parseTranscribeFields(form)`: `purpose` in `TRANSCRIBE_PURPOSES`, optional `referenceText` ≤ 300 chars, required when `purpose ∈ {shadowing, pronunciation, placement}`.
   - `parseTtsQuery(url, { catalogHas })`.
   - `parseProgressEvent(raw, { drillExists, nowMs }): Result<ClientProgressEvent>`:
     - `eventId` is a UUID;
     - **rejects `pronunciation_report`**;
     - `card.itemId === attempt.itemId`, and `drillExists(itemId)`;
     - ease in [1.3, 5], `intervalDays` in [0, 180], `repetitions`/`lapses` are integers ≥ 0;
     - `answer` ≤ 500 or null (null required when `inputMode !== 'typed'`), `durationMs` in [0, 600000];
     - `session.id` is a UUID, `endedAt ≥ startedAt`;
     - every timestamp is within [now − 30 d, now + 5 min];
     - enum fields are checked against the §5 lists; unknown keys are dropped.
   - `parsePrivacyRequest`.
2. **`rateLimit.ts`**: in-memory token buckets per `(scope, key, route)`.
   - The IP scope uses capacity × `IP_CAPACITY_MULTIPLIER`.
   - The user scope also enforces `RATE_LIMITS[route].dailyBudget` (paid calls: transcribe, chat, tts) over a rolling UTC day.
   - LRU-capped at 10k keys.
   - Documented as **per instance** (README + SECURITY).
3. **`clientIp.ts`**: `makeClientIp(trustedProxyHops = 1)` returns a function that uses `x-real-ip`, else the hop at `len − trustedProxyHops` in `x-forwarded-for`, else `null` (which skips the IP bucket).
4. **`origin.ts`**: same-origin or allowlist only; no ACAO header ever; a foreign `OPTIONS` → 403.
5. **`audio.ts`**:
   - `sniffAudioMime` checks magic bytes, and the declared type must match the sniffed type.
   - `readBodyCapped(req, maxBytes)` rejects on a `Content-Length` over the cap, then stream-counts and aborts.
   - **`req.formData()` is never called directly.** The flow is `buf = readBodyCapped(req, maxAudioBytes + 64 KB)`, then `new Response(buf, { headers: { 'content-type': req.headers.get('content-type') } }).formData()`.
6. **`sanitize.ts`**: unchanged (NFC, strip controls, clamp, neutralise `learner_utterance` look-alike tags, `wrapLearnerUtterance`).
   **`jwt.ts`**: `precheckJwt(token, nowMs)`: 3 base64url parts, `exp * 1000 > nowMs` (**`exp` is in seconds**), `sub` is a UUID, `aud === 'authenticated'`.
7. **Prompts.** They take **objects**, never ids: `buildTutorSystemPrompt({ mode, level, scenario?: Scenario, topic?: DebateTopic, falseFriends })`.
   - Fixed security preamble (data-not-instructions, English replies, no role change).
   - The code-switch rule: answer naturally in English using the English term; ask "Do you mean…?" when unsure.
   - The false-friend list from C.
   - At most 3 sentences per reply.
   - `debateFeedback.ts` asks for strict JSON and mentions `EN_FALSE_FRIENDS`.
   - `transcribe.ts` gives the per-purpose Whisper options: `chat` → auto language + code-switch-preserving prompt; `shadowing|pronunciation|placement` → `language: 'en'`, **no prompt and no reference text**.
8. **Adapters** (plain `fetch`, injected `fetchImpl`, `AbortSignal.timeout` (transcribe 30 s, chat 20 s, tts 15 s), one retry on 429/5xx; upstream bodies never leak):
   - **`openaiTranscriber.ts`**: `POST /v1/audio/transcriptions`, `model=whisper-1`, `response_format=verbose_json`, `timestamp_granularities[]=word` **and** `timestamp_granularities[]=segment`, options from `prompts/transcribe.ts`.
     - Per word, `confidence = clamp01(exp(seg.avg_logprob)) × (1 − seg.no_speech_prob)`, taken from the segment containing the word's midpoint. This is documented as coarse.
     - `noSpeechProb` is the duration-weighted mean over segments.
     - `language` `'english'` → `'en'`, `'french'` → `'fr'`, otherwise `'unknown'`. The handler sets `'mixed'` when C finds French spans.
   - **`openaiTts.ts`**: `POST /v1/audio/speech` (`model` from `OPENAI_TTS_MODEL`, `voice`, `response_format: 'mp3'`).
   - **`anthropicChat.ts`**: `/v1/messages`, `anthropic-version: 2023-06-01`. **JSON mode** = system instruction plus an assistant **prefill `{`**; the adapter prepends `{` to the completion before returning it.
   - **`openaiChat.ts`**: `/v1/chat/completions` with `response_format: {type: 'json_object'}` in JSON mode.
   - **`supabaseAuth.ts`**:
     - `GET /auth/v1/user` (`apikey` = anon or `sb_publishable_` key, Bearer = the user's JWT).
     - Positive results are cached ≤ 60 s and never past `exp`; **negative results are cached 10 s**. Both are keyed by the SHA-256 of the token.
   - **`supabaseProgress.ts`**: PostgREST with the user JWT, through `src/lib/db` only.
     - `record` maps events to RPCs: `drill_attempt` → `record_drill_attempt` (atomic attempt + SRS upsert + idempotency); `vocab_result`/`franglais_saved` → `record_vocab`; `pronunciation_report` → `increment_weak_phonemes`; other events → `record_event`.
     - `getSnapshot(auth, { tzOffsetMin })` runs in parallel: the profile with consent; `sessions` ordered by `ended_at desc` limit 20 (recent); `sessions.ended_at` for the last 400 days limit 1000, fed to `computeStreak`; vocabulary; weak phonemes; SRS cards.
   - **`supabasePrivacy.ts`**: consent insert, an export (parallel GETs), and `rpc/delete_my_account`.
   - **`memoryTtsCache.ts`**: an LRU of 200 entries keyed by `catalog:id:voice:model`.
9. **Handlers.** `common.ts` `withGuards` runs in this order:
   1. method;
   2. origin;
   3. **IP rate limit**;
   4. **JWT precheck**;
   5. auth;
   6. **user rate limit + daily budget**;
   7. capped body;
   8. validate;
   9. ports.

   Responses are JSON with `Cache-Control: no-store`, and errors are `ApiErrorBody`.

   | Route | Method | Request | Response | Notes |
   |---|---|---|---|---|
   | `/api/transcribe` | POST | multipart: `audio` (≤ 4 MB, allowed and sniffed), `purpose`, optional `referenceText` | `TranscribeResponse` | `no_speech` when `noSpeechProb > 0.6` or `isHallucination(text)` or empty text. Then: no progress write, no code-switch analysis. Otherwise `analyzeCodeSwitch`, and if `referenceText` is set, `scorePronunciation` → `report`, plus `await` `progress.record({type: 'pronunciation_report'})` with a **2 s timeout, failure swallowed**. Requires consent. Does **not** reject on post-transcription `durationSec`; length is enforced by the byte cap and the client. |
   | `/api/chat` | POST | `ChatRequest` | `ChatResponse` | Lookups `getScenario`/`getTopic` resolve objects for the prompt. `reply`: clamped to 1200 chars; `codeSwitch` is null at C1. `debate_feedback`: JSON mode → `parseDebateFeedback` (one repair retry), then `codeSwitchCards = analyzeCodeSwitch(userTurns.join('\n')).cards`. |
   | `/api/tts` | GET | `?catalog=&id=` (`[&timings=1]`) | `audio/mpeg`, or `TtsTimings` JSON | Fixed catalog only: shadowing `textEn`, hint `en`, non-sensitive practice words. Server cache, then `Cache-Control: public, max-age=31536000, immutable`, keyed by catalog version. `timings=1` runs Whisper (word granularity) on the TTS audio once and caches the result, for karaoke highlights. Auth required, user rate limit. |
   | `/api/progress` | GET / POST | `?tz=<int −840..840>` / `ClientProgressEvent` | `ProgressSnapshot` / `{ok: true}` | Idempotent through `eventId`. |
   | `/api/privacy` | GET / POST | `?export=1` / `PrivacyRequest` | `PrivacyExport` (`Content-Disposition: attachment`) / `{ok: true}` | `delete_account` calls the RPC and then returns 200. The client then signs out and clears that user's IndexedDB bucket. |

10. **`app/api/*/route.ts`**: literal `runtime`/`dynamic` exports plus a one-line delegate. `deps.ts` builds the singletons and reads `TRUSTED_PROXY_HOPS`.

**Verify [HERE]:**

```bash
node --experimental-strip-types --test 'src/lib/security/**/*.test.ts' 'src/lib/prompts/**/*.test.ts' 'src/lib/ports/**/*.test.ts' 'src/server/**/*.test.ts'
tsc -p tsconfig.lib.json --typeRoots /opt/npm-tools/node_modules/@types
```

**Acceptance [HERE]** (real `Request`/`FormData`/`Blob` with fake ports):

**Guards and limits**
- Guard order is proved: a foreign origin with no token → 403 (not 401); IP-limited before auth → 429 without calling `auth.verify`; a junk token → 401 without calling the network verifier.
- A negative auth result is cached for 10 s.
- `exp` in seconds is handled: a token with `exp = now/1000 + 60` passes and one with `exp = now/1000 − 1` fails.
- The 301st transcribe of the day → 429 (daily budget).
- `clientIp` handles `x-real-ip`, a 2-hop XFF with `TRUSTED_PROXY_HOPS=1`, and absent headers (null, so the IP bucket is skipped).

**Audio upload**
- 5 MB audio → 413 before the full read, using a stream that throws past the cap.
- `text/plain` labelled as `audio/webm` → 415.
- `formData()` is never called on the original request (asserted by a spy).
- `no_speech_prob 0.8` → `{status: 'no_speech'}` with no `progress.record` call.
- Each hallucination phrase → `no_speech`.

**Transcribe and scoring**
- `referenceText` is never sent to the fake transcriber, and `language === 'en'` is sent for shadowing.
- A progress-store hang of 5 s → the response still returns in about 2 s with a `report`.

**Request size**
- Chat: 40 × 2000-char messages → 413 (an 80 KB body exceeds 64 KB).
- Chat: 25 short messages → 200, with the prompt built from the last 20.
- Debate feedback: 9 × 1900-char turns → 400 (`maxDebateFeedbackChars`).

**Progress events**
- `parseProgressEvent` rejects `pronunciation_report`, mismatched `itemId`, ease 1.2, an answer with `inputMode: 'spoken'`, and a timestamp 40 days old.

**Prompts and adapters**
- The injection test from revision 1 passes.
- The Anthropic JSON prefill is tested: the adapter returns a string beginning with `{`.
- Adapter tests assert exact URLs and header names, and that keys appear only in auth headers.
- Transcriber confidence mapping: `avg_logprob −0.1` with `no_speech 0.1` → ≈ 0.814.
- An upstream 500 → 502 with a generic message.

**TTS**
- A TTS request for an unknown id or a sensitive word → 404.
- A second TTS request is served from the cache, so the synthesizer is called once.
- The TTS response has the `immutable` header.

**Boundaries**
- `check-boundaries` is clean.

### Unit G: Supabase schema, RLS, RPCs, row mappers

**Owns:** see §7.0.

**Tables.** Every table has `user_id uuid not null references auth.users(id) on delete cascade`. Numeric columns that hold ease, intervals or mastery are **`double precision`, never `real`**. Every text column has a `char_length` check: ids ≤ 64, `term`/`french_term` ≤ 120, `answer` ≤ 500, `version` ≤ 32.

| Table | Key | Columns (beyond user_id) |
|---|---|---|
| `profiles` | pk `user_id` | `cefr_level text null check in CEFR_LEVELS`, `native_lang text default 'fr' check (= 'fr')`, `age_band text null check in AGE_BANDS`, `settings jsonb not null default '{}'` (validated keys), `created_at`, `updated_at` (trigger `set_updated_at`) |
| `privacy_consents` | pk `(user_id, version)` | `accepted_at timestamptz not null default now()`, `age_band text not null check in AGE_BANDS` |
| `sessions` | pk `id uuid` (client UUID) | `kind check in SESSION_KINDS`, `level check`, `scenario_id`/`topic_id text null ≤ 64`, `started_at`, `ended_at check (ended_at >= started_at)`, `words_spoken int 0..100000`, `code_switch_count int 0..10000`, `pronunciation_avg double precision null 0..100`; index `(user_id, ended_at desc)` |
| `vocabulary_mastery` | pk `(user_id, term)` | `french_term`, `source check in VOCAB_SOURCES`, `mastery double precision 0..1`, `seen_count int ≥ 0`, `saved bool`, `last_seen_at` |
| `weak_phonemes` | pk `(user_id, trap_id)` | `trap_id check in TRAP_IDS`, `error_count int ≥ 0`, `attempt_count int ≥ 0`, table check `attempt_count >= error_count`, `last_seen_at` |
| `drill_attempts` | pk `id uuid` (client UUID) | `item_id ≤ 64`, `answer text null ≤ 500` with `check (input_mode = 'typed' or answer is null)`, `correct`, `grade check in REVIEW_GRADES`, `duration_ms 0..600000`, `input_mode check in INPUT_MODES`, `answered_at`; index `(user_id, answered_at desc)` |
| `srs_cards` | pk `(user_id, item_id)` | `ease double precision check (ease >= 1.3 and ease <= 5)`, `interval_days double precision 0..180`, `repetitions int ≥ 0`, `lapses int ≥ 0`, `due_at`, `last_reviewed_at null` |
| `processed_events` | pk `(user_id, event_id uuid)` | `processed_at timestamptz default now()` |

**Grants** (explicit):
- `grant usage on schema public to authenticated;`
- `grant select, insert, update, delete on <each table> to authenticated;`
- `revoke all on <each table> from anon, public;`

**RLS.** Enabled on every table, with 4 policies per table using `(select auth.uid()) = user_id`.
- `processed_events` and `privacy_consents` get select and insert only.
- `sessions` and `drill_attempts` get select, insert and delete (no update).

**RPCs.** All are `security invoker`, `set search_path = ''`, use `auth.uid()` internally, and are granted to `authenticated` and revoked from `anon` and `public`.
- **Idempotency:** each RPC takes `p_event_id uuid`, inserts into `processed_events`, and on conflict returns without doing anything.
- **`record_drill_attempt(p_event_id, p_attempt jsonb, p_card jsonb)`**: one transaction that inserts the attempt and upserts `srs_cards`.
- **`record_vocab(p_event_id, p_items jsonb)`**:
  - at most `maxVocabItemsPerCall` (50) items, otherwise an exception;
  - applies the EMA server-side: `mastery = mastery + 0.3 × (correct − mastery)`;
  - increments `seen_count`;
  - `franglais_saved` sets `saved = true`.
- **`increment_weak_phonemes(p_event_id, p_counts jsonb)`**:
  - rejects any key not in `TRAP_IDS` and any value outside 0..100;
  - keeps `attempt_count >= error_count`.
- **`record_event(p_event_id, p_event jsonb)`**: handles `level_set`, `settings_updated` and `session_completed`.
- **`delete_my_account()`** is `security definer` and is the **only definer function besides the profile trigger**.
  - `set search_path = ''`.
  - It deletes only rows `where user_id = auth.uid()` from every table, then `delete from auth.users where id = auth.uid()`.
  - It is granted to `authenticated` only.
- **Profile trigger:** on insert into `auth.users`, a definer function inserts `profiles(user_id)` only.

**Retention.** A `drill_attempts` retention job (e.g. `pg_cron`, delete rows older than 365 d) is **required**. The SQL for it is shipped commented-out, and the README makes enabling it a setup step.

**`src/lib/db/index.ts`** re-exports `TABLES`, `RPC`, row types and mappers. The mappers convert ISO ↔ `EpochMs`.

**`run-local.sh`**:
1. `PGBIN=/usr/lib/postgresql/16/bin`. Skip with a message if it is missing.
2. `D=$(mktemp -d)`.
3. If `id -u` is 0: `chown postgres "$D"`, and prefix every `initdb`/`pg_ctl`/`psql` call with `runuser -u postgres --`.
4. `initdb -D $D/data`, then `pg_ctl -D $D/data -o "-p 54329 -k $D" -w start`.
5. Apply `00_auth_stub.sql`, then the migration, then `rls.sql`, each with `psql -v ON_ERROR_STOP=1`.
6. Stop the server and remove the directory (`trap` on exit).

**`00_auth_stub.sql`**:
- roles `anon`, `authenticated` (nologin);
- schema `auth`, table `auth.users(id uuid pk)`;
- `auth.uid()` returns `coalesce(current_setting('request.jwt.claim.sub', true), current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid`.

**`rls.sql`**. Every assertion runs after `set local role authenticated` and `select set_config('request.jwt.claim.sub', '<uuid>', true)` inside a transaction.
1. A positive own-row insert for user A, including `ease = 1.3` (asserts success).
2. A reads its own rows; A sees 0 of B's rows.
3. A cross-user insert raises, and `SQLERRM like '%row-level security%'` is asserted.
4. `set local role anon`: `select` on profiles raises `permission denied` (exactly this one expected outcome).
5. `record_drill_attempt` with the same `event_id` twice → one attempt row.
6. `record_vocab` with 51 items raises; the EMA after one correct result from new = 0.3.
7. `increment_weak_phonemes` with a bogus key raises.
8. `delete_my_account` as A removes all of A's rows and leaves B's intact.
9. A typed answer is stored, and a spoken answer with non-null text raises.

**Verify [HERE]:**

```bash
node --experimental-strip-types --test 'src/lib/db/**/*.test.ts'
bash supabase/tests/run-local.sh
```

**Acceptance [HERE]:**
- `migration.test.ts` asserts:
  - every public table has `enable row level security`, the grants and policies referencing `auth.uid()`;
  - each SQL `check … in (…)` list equals its §5 array (`TRAP_IDS`, `SESSION_KINDS`, `REVIEW_GRADES`, `VOCAB_SOURCES`, `INPUT_MODES`, `AGE_BANDS`, `CEFR_LEVELS`);
  - **no `\breal\b`** appears;
  - `security definer` appears exactly twice (the profile trigger and `delete_my_account`);
  - no policy predicate is `true`;
  - every text column has a `char_length` check.
- `run-local.sh` exits 0 with every assertion above passing.

### Unit H1: Client logic and runtime (`src/lib/ui/**`, `src/client/**`)

**Owns:** see §7.0.

1. **`strings.ts`**: `STRINGS: Record<StringKey, { fr: string; bi: string; en: string }>` holds all UI copy, including design 04 §10 microcopy and the privacy and processor disclosure text, imported from design. `t(key, mode)` picks the variant. Practice-content language attributes (`lang="en"`/`"fr"`) are handled by the component wrappers.
2. **`highlight.ts`**: `tokenizeForHighlight`, `activeIndexAtTime(words, tSec)`, `activeIndexAtChar`. Shadowing highlights come from `/api/tts?timings=1`, or from `speechSynthesis` boundary events in the fallback.
3. **`sessionMachine.ts`**:
   - `idle → recording → uploading → thinking → speaking → idle`, plus `error`.
   - `thinkingSlow` at 3 s, retry offer at 8 s.
   - **Silence nudges** while waiting for the user: gentle prompt at 6 s, hint chips at 12 s, the exit/type option at 25 s.
   - Timestamps are injected.
4. **`errorLadder.ts`**: rungs 1-3 plus the French-only rung. `no_speech` counts as a failure.
   **`sideCardQueue.ts`**: max 2 visible, collapse after 6 s **unless `sideCardAutoCollapse` is false**, dedupe, dismiss, save, and the "Ce n'est pas du français" action that adds to `ignoredTerms`.
5. **`outbox.ts`**: an outbox reducer. Events are keyed by `eventId`. Actions: enqueue, mark-sent, retry with backoff, and drop on a 4xx other than 429.
   **`localStoreReducers.ts`**: state is **keyed by `userId`** (the guest bucket is `'guest'`). The guest bucket is migrated into a user bucket only on an explicit confirm action. It holds the device-local debate reviews ("your turns are kept on this device"), `ignoredTerms`, SRS cards and settings.
6. **`recorderGate.ts`**: from RMS/peak and duration stats, return `too_short` (< 0.4 s), `silent` (RMS below threshold) or `ok`. **`recorderMime.ts`**: webm/opus > mp4 > ogg.
7. **`src/client/`** (DOM-only, type-checked):
   - **`auth.ts`**: GoTrue REST through `fetch`:
     - `POST /auth/v1/otp` sends `{email, create_user: true}`;
     - `POST /auth/v1/verify` sends `{type: 'email', email, token}`;
     - `POST /auth/v1/token?grant_type=refresh_token` refreshes;
     - each call sends `apikey: NEXT_PUBLIC_SUPABASE_ANON_KEY` (or an `sb_publishable_` key);
     - the session lives in memory plus IndexedDB, with a refresh 60 s before `expires_at`.
   - **`api.ts`**: typed wrappers for §8.
   - **`recorder.ts`**: MediaRecorder with `audioBitsPerSecond: 32000`, a 60 s stop, a 4 MB cap, and an AnalyserNode feeding `recorderGate`.
   - **`tts.ts`**: plays `/api/tts` audio at `playbackRate` (0.6 / 0.85 / 1). The fallback is `speechSynthesis`, and if no English voice exists it reports `no_voice`, which means text-only.
   - **`localStore.ts`**: IndexedDB wrapper over the reducers.
   - **`sync.ts`**: flushes the outbox.
   - **`events.ts`**: emitters:
     - a drill result emits `drill_attempt` + `vocab_result {term: correctEn, correct}`;
     - the end of a drill set emits `session_completed {kind: 'drill'}`;
     - a saved Franglais card emits `franglais_saved`, and saying it correctly later emits `vocab_result {correct: true}`.

**Verify [HERE]:**

```bash
node --experimental-strip-types --test 'src/lib/ui/**/*.test.ts'
tsc -p tsconfig.lib.json --typeRoots /opt/npm-tools/node_modules/@types   # includes src/client/**
```

**Acceptance [HERE]:**
- **Strings:** every key has a non-empty `fr`.
- **Session machine and ladder:** silence nudges fire at 6, 12 and 25 s and not before; `no_speech` advances the ladder.
- **Side-card queue:** with `sideCardAutoCollapse: false`, no collapse after 60 s.
- **Outbox:** dedupes by `eventId` and drops on 400; the guest bucket is not merged without confirm.
- **Recorder gate:** 0.3 s → `too_short`; silence → `silent`.
- **Highlight:** the index is correct at boundaries.
- **Client code:** tsc is clean over `src/client/**` with no npm imports.
- [MANUAL] The OTP sign-in round trip against a real Supabase project.

### Unit H2: Core-loop screens

**Owns:** see §7.0. Follows `docs/design/03-key-screens.md` and `05-accessibility.md`.

**Screens**
- **Home:** today's plan, "Défi du jour, 2 min", and a card to continue the default mode.
- **Onboarding:**
  1. welcome;
  2. **`AgeGate`** (15+; under 15 blocked; 15-17 → sensitive reveal off);
  3. **`ConsentSheet`** with the honest processor disclosure (audio and transcripts are sent to OpenAI and Anthropic/OpenAI; no "never stored" claim; link to `/privacy`), then `accept_consent`;
  4. `MicPermissionGate`;
  5. goal;
  6. `PlacementQuiz` (5-6 items; **self-select path when mic is denied or offline**; speak items skipped when signed out).
- **Sign-in:** email OTP code entry.
- **Shadowing:**
  - sentence plus translation (A-levels);
  - **speed control 0.6× / 0.85× / 1×**;
  - karaoke highlight from timings;
  - record → `/api/transcribe` with `referenceText` → `report`;
  - `WordHighlight` renders from `charStart`/`charEnd` only, with `aria-label` "word, presque";
  - `unsure` is shown neutral;
  - one tip;
  - labelled "Vérification de compréhension / Intelligibility check".
- **Drills:**
  - `DrillRunner` with a 120 s budget;
  - typed, spoken (with the `confirm` self-confirm flow) or self-check when offline or guest;
  - emits events through H1.
- **Pronunciation:**
  - `TrapCard` list with a `?trap=` deep link mapped through `TRAP_DEEPLINK`;
  - `MouthDiagram` (`role="img"`, `<title>`, long alt text);
  - minimal pairs; the sensitive pair shows only "beach", and the rude word sits behind a tap-to-reveal note (disabled when `ageBand === '15-17'`);
  - **no audio for the sensitive word unless there is an explicit opt-in tap**, which uses local `speechSynthesis`.
- **Progress:**
  - streak;
  - weak phonemes, shown only when `attemptCount ≥ minPhonemeAttempts`;
  - phrase bank;
  - recent sessions.
- **Settings:**
  - level, captions;
  - `playbackRate`, `textAnswerMode`, `sideCardAutoCollapse`, `silenceAnnouncementsWhileRecording` (all persisted through `settings_updated`);
  - sign-out.
- **Privacy:** the processor disclosure, retention facts, **Export my data** (`GET /api/privacy?export=1`), and **Delete my account** (typed "SUPPRIMER" confirm, then clear the local bucket).

**Accessibility (from 05)**
- The mic button is a `<button>` whose `aria-label` reflects its state ("Appuie pour parler" / "Interrompre"). It has **no `aria-pressed`** (05 line 34); `data-state` is for styling only.
- `role="status"` announcements are suppressed while recording when `silenceAnnouncementsWhileRecording` is on.
- **Every practice screen offers text-answer mode.**
- Touch targets ≥ 44 px through tokens.
- `lang` attributes on practice content.

**Acceptance**
- [HERE] `check-routes.mjs` passes for H2's routes.
- [HERE] `check-boundaries` is clean: rules 8 (no hex colours in style contexts), 9 (no `aria-pressed` on `MicButton`) and 10 (no French literals outside `STRINGS`).
- [MANUAL] Each screen against design 03 and 05; screen-reader pass; offline drills; delete and export flows (MANUAL_QA §Core, §Privacy, §A11y).

### Unit H3: Roleplay and debate screens

**Owns:** see §7.0.

**Roleplay**
- `ScenarioPicker` (`?scenario=`).
- 3 `HintChips`: tap shows `explanationFr`, and hint audio comes through `/api/tts?catalog=hint`.
- The push-to-talk loop: transcribe (`purpose: chat`), then chat, then tts.
- `SideCardStack` under the user's bubble after the AI reply starts, with Hear, Save and « Ce n'est pas du français ».
- The `allFrench` nudge only on `status: 'ok'`.
- Text-answer mode.

**Debate**
- `TopicPicker`, then the session (no live cards at C1).
- End → `debate_feedback` → `DebateFeedbackView` (`?review=<id>` reads the IndexedDB review), including `codeSwitchCards`.
- Notice: « Tes réponses sont gardées sur cet appareil. »

**Acceptance**
- [HERE] `check-routes`/`check-boundaries` clean for H3's files.
- [MANUAL] End-to-end roleplay with a Franglais card; debate feedback rendering; TTS fallback to `speechSynthesis` and then to text-only (MANUAL_QA §Conversation).

### Unit I: README, SECURITY, MANUAL_QA

**Owns:** see §7.0.

1. **README**
   - Setup and architecture.
   - The env table (§9).
   - **Supabase:**
     - create the project in an **EU region**;
     - run the migration;
     - **enable the `drill_attempts` retention job (required)**;
     - enable email OTP;
     - note that `sb_publishable_` keys work as `apikey`;
     - note that per-user row volume is not bounded by the app layer.
   - **OpenAI:** request zero data retention where eligible, and sign the DPA. **Anthropic:** DPA and commercial terms.
   - The scripts.
   - PWA install.
   - **Limitations:**
     - the intelligibility check is not a pronunciation grade;
     - stress is not detected;
     - Whisper may anglicise French words;
     - the rate limiter is per instance;
     - realtime is v2.
   - Data export and deletion.
2. **`docs/SECURITY.md`**: §11 with the owner and test path for each item.
3. **`docs/MANUAL_QA.md`**: every [MANUAL] item from §7, each with an owner and expected result, plus:
   - **§Calibration:**
     1. Record about 20 French-accented clips (minimal pairs and sentences).
     2. Store the raw `verbose_json` under `src/lib/pronunciation/fixtures/real/`.
     3. Acceptance: the scorer flags at least N known errors with no `error` status in sentence mode. N is chosen at calibration.
   - States that the offline tests are synthetic.

**Verify [HERE]:**
- `markdownlint-cli2 README.md docs/SECURITY.md docs/MANUAL_QA.md`.
- `node scripts/check-docs.mjs` (every `.env.example` var is in the README).
- A grep confirms every `[MANUAL]` tag in PLAN §7 has a MANUAL_QA entry.

---
## 8. HTTP contract summary (for H1/H2/H3 and F)

All routes are same-origin and require `Authorization: Bearer <Supabase access token>`. Mic routes (transcribe) also require a current consent.

| Route | Method | Request | Response |
|---|---|---|---|
| `/api/transcribe` | POST | multipart: `audio`, `purpose`, `referenceText?` | `TranscribeResponse` |
| `/api/chat` | POST | `ChatRequest` | `ChatResponse` |
| `/api/tts` | GET | `catalog`, `id`, `timings?` | audio/mpeg, or `TtsTimings` |
| `/api/progress` | GET / POST | `tz` / `ClientProgressEvent` | `ProgressSnapshot` / `{ok: true}` |
| `/api/privacy` | GET / POST | `export=1` / `PrivacyRequest` | `PrivacyExport` / `{ok: true}` |

**Errors** return `ApiErrorBody` with these statuses:

| Status | Meaning |
|---|---|
| 400 | bad_request |
| 401 | unauthorized |
| 403 | forbidden (including missing consent) |
| 404 | not_found |
| 413 | payload_too_large |
| 415 | unsupported_media_type |
| 429 | rate_limited, with `Retry-After` |
| 502 | upstream_error |
| 504 | upstream_timeout |
| 500 | internal |

**Caching:** every route sends `no-store`, except `/api/tts`, which is `public, immutable`.

## 9. Environment variables

| Var | Side | Required | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | server | yes | Whisper, TTS, optional chat |
| `ANTHROPIC_API_KEY` | server | if `LLM_PROVIDER=anthropic` | chat and feedback |
| `LLM_PROVIDER` | server | no (`anthropic`) | `anthropic` \| `openai` |
| `ANTHROPIC_MODEL`, `OPENAI_CHAT_MODEL` | server | no | model ids (defaults in the README) |
| `OPENAI_TTS_MODEL`, `OPENAI_TTS_VOICE` | server | no | TTS model and voice |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | server | yes | PostgREST/GoTrue calls with the user JWT (`sb_publishable_` accepted) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | yes | GoTrue REST auth from the browser |
| `ALLOWED_ORIGINS` | server | yes in prod | origin allowlist |
| `TRUSTED_PROXY_HOPS` | server | no (1) | XFF parsing for the IP bucket |

There is deliberately no service-role key. `.env.example` lists exactly these, and `check-docs.mjs` verifies the README does too.

## 10. Integration gate (after all units land) [HERE]

```bash
cd /home/claude/parle-to-speak
node --experimental-strip-types --test 'src/**/*.test.ts' 'scripts/**/*.test.ts'
tsc -p tsconfig.lib.json --typeRoots /opt/npm-tools/node_modules/@types
node scripts/check-boundaries.mjs && node scripts/check-routes.mjs && node scripts/check-docs.mjs
bash supabase/tests/run-local.sh
test -f src/styles/tokens.css && test -f src/styles/globals.css
```

All of these must exit 0. Everything else is [MANUAL] and listed in `docs/MANUAL_QA.md`:

- `npm install`
- `npm run typecheck` (with `.tsx`)
- `npm run build` + `postbuild` precache
- Lighthouse PWA
- live API smoke tests
- calibration
- the accessibility pass

## 11. Security and privacy checklist

| # | Item | Owner | Enforced or tested by |
|---|---|---|---|
| S1 | Keys in server env only; never `NEXT_PUBLIC_`, logged or in URLs | F, A | check-boundaries 1/2; adapter header tests |
| S2 | Client import closure never reaches `src/server` or `src/lib/prompts`; no SDKs | A, H1-3 | check-boundaries 1b/7 |
| S3 | v1 has no browser-held provider credentials (realtime deferred) | — | absence check: check-boundaries 7, CSP `connect-src` |
| S4 | Prompt injection: sanitise, delimit, preamble, no tools, no client `system` role, output caps, strict JSON parse, text-only rendering | F, E, H | `sanitize`/`chat`/`feedback` tests; check-boundaries 4 |
| S5 | Auth: precheck (`exp` in seconds), then GoTrue verify; positive cache ≤ 60 s and never past `exp`; negative cache 10 s | F | `common`/`supabaseAuth` tests |
| S6 | The DB is the boundary: grants, RLS on 4 verbs, SQL checks mirroring §5 lists and limits, idempotent invoker RPCs, a single scoped definer delete | G | `migration.test.ts`, `run-local.sh` |
| S7 | Rate limits: IP before auth, then per user plus a daily paid-call budget; documented as per instance | F, I | `rateLimit`/handler tests |
| S8 | CORS same-origin only, no ACAO | F | `origin.test.ts` |
| S9 | Audio ≤ 4 MB streaming cap, sniffed mime, `formData` only from the capped buffer, silence and hallucination guard | F, C, H1 | `audio`/`transcribe`/`hallucinations`/`recorderGate` tests |
| S10 | Scoring integrity: the server transcribes the audio itself; clients cannot post transcripts or `pronunciation_report` | F | `transcribe`/`validate` tests |
| S11 | Bodies ≤ 64 KB; field bounds; event sanity ranges and timestamp windows | F, G | `validate` tests + SQL checks |
| S12 | Upstream errors not leaked; no secrets or transcripts in logs | F | adapter tests |
| S13 | Headers: CSP (prod/dev), Permissions-Policy, nosniff, `frame-ancestors 'none'`; API `no-store` | A, F | [MANUAL] header check + handler tests |
| S14 | SW never caches API, RSC, redirects or non-200 | A | `sw.test.ts`, check-boundaries 6 |
| S15 | Privacy: honest processor disclosure, versioned consent gating the mic, age gate, export, delete, typed-only answer storage, required retention job, EU region and DPAs | G, H2, I | `rls.sql`, `migration.test.ts`, [MANUAL] privacy flows |
| S16 | Sensitive content excluded from practice, TTS and drills; reveal gated and off for 15-17 | B, D, E, F, H2 | B/D/E content tests, F TTS 404 test |
| S17 | No `dangerouslySetInnerHTML` | H | check-boundaries 4 |

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| R1: Next 15 and `.ts`-extension imports | `allowImportingTsExtensions` + `noEmit`. Fallback: a codemod on the `.tsx` imports only. [MANUAL] |
| R2: Whisper confidence is coarse (segment-level) | `defaultConfidence`, `unsure` bands, `warn`-only in sentences, labelled as an intelligibility check, plus the calibration milestone. |
| R3: Whisper silence hallucinations or anglicisation | no-speech threshold + denylist + client gate; false-friend lists; best-effort wording. |
| R4: The in-memory limiter is per instance | Documented; the port allows a shared store. Daily budgets bound the cost per instance. |
| R5: tsc 7 (native) vs the project's TypeScript 5.8 differ | `tsconfig.lib.json` uses only options both support; `npm run typecheck:lib` with the local 5.8 is a [MANUAL] check. |
| R6: The privacy copy needs legal review | The copy lives in `strings.ts` keys; a legal-review item is in MANUAL_QA. |

## 13. Open questions and notes to the designer

- [ ] LLM default: Claude (default) or GPT-4o.
- [ ] Guest scope: drills (typed or self-check), shadowing playback with browser TTS, and the trap library work signed out; everything else needs sign-in. Server TTS requires auth, so guests get `speechSynthesis` only.
- [ ] A shared rate-limit store before public launch.
- [ ] Should the level auto-adjust over time (design 02 §7)? Default: changed by the user only.
- [ ] Calibration threshold N (set after the first real clips).
- **Designer notes (no design files edited by this plan):**
  - debate reviews are device-local, so the copy should say « Tes réponses sont gardées sur cet appareil »;
  - labels for the new settings (speed 0.6×, side-card timeout, silence announcements);
  - the age-gate and consent screens;
  - the `/privacy` page;
  - a "no English voice" text-only state.
