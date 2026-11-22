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
