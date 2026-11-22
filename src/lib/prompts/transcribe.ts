// src/lib/prompts/transcribe.ts
//
// Binding rule for F2's Whisper adapter: NO prompt/context hint is ever
// sent for purposes 'shadowing' | 'pronunciation' | 'placement'. Only
// 'chat' may get a light, code-switch-preserving prompt. A context hint
// for the other purposes would bias Whisper toward "correcting" the
// transcript toward the text the learner is being scored against, which
// would defeat the pronunciation/placement checks.

import type { TranscribePurpose } from '../types.ts';

export function getTranscribePrompt(purpose: TranscribePurpose): string | undefined {
  if (purpose === 'chat') {
    return 'This is a conversation that may mix French and English words; transcribe exactly what is said, including any French words, without correcting them.';
  }
  return undefined;
}

export function getTranscribeLanguageHint(purpose: TranscribePurpose): 'en' | undefined {
  if (purpose === 'shadowing' || purpose === 'pronunciation' || purpose === 'placement') {
    return 'en';
  }
  return undefined;
}
