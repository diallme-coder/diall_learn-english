// src/lib/ui/sessionMachine.ts: pure state machine for one practice/conversation turn
// (design 04 §1-2, §8). Push-to-talk (explicit start/stop) and hands-free (VAD-driven start/stop)
// are two input modes the same machine supports. This module never sets a timer itself: elapsed
// time and events are injected by the caller, and `nudgeForElapsed` just says what silence-nudge
// level applies at a given elapsed time.

export type SessionState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error' | 'offline' | 'denied';
export type TurnMode = 'push_to_talk' | 'hands_free';

/** Silence-nudge timing constants (design 04 §2): gentle prompt, help chips, then pause+exit offer. */
export const SILENCE_NUDGE_MS = { gentle: 6000, help: 12000, exit: 25000 } as const;
export type SilenceNudgeLevel = keyof typeof SILENCE_NUDGE_MS;

/** Which silence-nudge level applies at `elapsedMs` of listening with no speech, if any. */
export function nudgeForElapsed(elapsedMs: number): SilenceNudgeLevel | null {
  if (elapsedMs >= SILENCE_NUDGE_MS.exit) return 'exit';
  if (elapsedMs >= SILENCE_NUDGE_MS.help) return 'help';
  if (elapsedMs >= SILENCE_NUDGE_MS.gentle) return 'gentle';
  return null;
}

export type SessionEvent =
  // push-to-talk: the user explicitly starts/stops capture
  | { type: 'ptt_start' }
  | { type: 'ptt_stop' }
  // hands-free: voice-activity detection starts/stops capture
  | { type: 'vad_speech_start' }
  | { type: 'vad_speech_end' }
  | { type: 'thinking_done' }
  | { type: 'speaking_done' }
  | { type: 'error_occurred' }
  | { type: 'retry' }
  | { type: 'went_offline' }
  | { type: 'went_online' }
  | { type: 'mic_denied' };

export interface SessionReduceInput {
  state: SessionState;
  mode: TurnMode;
  elapsedMs: number;
  events: readonly SessionEvent[];
}

export interface SessionReduceResult {
  state: SessionState;
  nudge?: SilenceNudgeLevel;
}

function applyEvent(state: SessionState, mode: TurnMode, event: SessionEvent): SessionState {
  // offline/denied/error are reachable from (almost) any state, and recoverable only via their own event.
  switch (event.type) {
    case 'went_offline':
      return 'offline';
    case 'mic_denied':
      return 'denied';
    case 'error_occurred':
      return 'error';
    case 'went_online':
      return state === 'offline' ? 'idle' : state;
    case 'retry':
      return state === 'error' || state === 'denied' ? 'idle' : state;
    default:
      break;
  }
  if (state === 'offline' || state === 'denied' || state === 'error') return state;

  if (mode === 'push_to_talk') {
    if (event.type === 'ptt_start' && state === 'idle') return 'listening';
    if (event.type === 'ptt_stop' && state === 'listening') return 'thinking';
  } else {
    if (event.type === 'vad_speech_start' && state === 'idle') return 'listening';
    if (event.type === 'vad_speech_end' && state === 'listening') return 'thinking';
  }
  if (event.type === 'thinking_done' && state === 'thinking') return 'speaking';
  if (event.type === 'speaking_done' && state === 'speaking') return 'idle';
  return state;
}

/** Pure reducer: folds `events` over `state`, and reports the silence nudge for `elapsedMs`. */
export function reduceSession(input: SessionReduceInput): SessionReduceResult {
  const finalState = input.events.reduce((s, event) => applyEvent(s, input.mode, event), input.state);
  if (finalState !== 'listening') return { state: finalState };
  const nudge = nudgeForElapsed(input.elapsedMs);
  return nudge === null ? { state: finalState } : { state: finalState, nudge };
}
