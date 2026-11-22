// src/lib/ui/errorLadder.ts: pure escalating recovery-message ladder for system and speech
// errors (design 04 §7). Rung 1 is a short friendly retry, rung 2 adds detail/help, rung 3
// offers a fallback (e.g. text mode). `no_speech` counts as a speech-ladder failure.
import type { StringKey } from './strings.ts';
import { t, type UiLangMode } from './strings.ts';

export type ErrorContext =
  | 'mic-denied'
  | 'network-offline'
  | 'upstream-timeout'
  | 'upstream-error'
  | 'rate-limited'
  | 'no_speech';

export type LadderAction = 'retry' | 'text-mode' | 'none';

export interface LadderRung {
  rung: 1 | 2 | 3;
  messageKey: StringKey;
  action: LadderAction;
}

const LADDERS: Record<ErrorContext, readonly LadderRung[]> = {
  'mic-denied': [
    { rung: 1, messageKey: 'micDenied', action: 'retry' },
    { rung: 2, messageKey: 'micNotFound', action: 'retry' },
    { rung: 3, messageKey: 'ladderTextMode', action: 'text-mode' },
  ],
  'network-offline': [
    { rung: 1, messageKey: 'offlineError', action: 'retry' },
    { rung: 2, messageKey: 'offlineError', action: 'retry' },
    { rung: 3, messageKey: 'ladderTextMode', action: 'text-mode' },
  ],
  'upstream-timeout': [
    { rung: 1, messageKey: 'networkSlow', action: 'retry' },
    { rung: 2, messageKey: 'networkSlowDetail', action: 'retry' },
    { rung: 3, messageKey: 'ladderTextMode', action: 'text-mode' },
  ],
  'upstream-error': [
    { rung: 1, messageKey: 'serverError', action: 'retry' },
    { rung: 2, messageKey: 'serverError', action: 'retry' },
    { rung: 3, messageKey: 'ladderTextMode', action: 'text-mode' },
  ],
  'rate-limited': [
    { rung: 1, messageKey: 'rateLimited', action: 'retry' },
    { rung: 2, messageKey: 'rateLimited', action: 'retry' },
    { rung: 3, messageKey: 'ladderTextMode', action: 'text-mode' },
  ],
  no_speech: [
    { rung: 1, messageKey: 'speechLadder1', action: 'retry' },
    { rung: 2, messageKey: 'speechLadder2', action: 'retry' },
    { rung: 3, messageKey: 'speechLadder3', action: 'text-mode' },
  ],
};

/** The full 3-rung ladder for a given error context. */
export function getErrorLadder(context: ErrorContext): readonly LadderRung[] {
  return LADDERS[context];
}

/** The rung for the Nth consecutive failure (1-based); clamps to the last rung past 3. */
export function rungForAttempt(context: ErrorContext, attempt: number): LadderRung {
  const ladder = LADDERS[context];
  const index = Math.min(Math.max(attempt, 1), ladder.length) - 1;
  // ladder has fixed length 3, so this index is always in range.
  return ladder[index] as LadderRung;
}

/** The ladder message text for the Nth failure, in the given UI language mode. */
export function errorLadderMessage(context: ErrorContext, attempt: number, mode: UiLangMode = 'fr'): string {
  return t(rungForAttempt(context, attempt).messageKey, mode);
}
