// src/lib/ui/recorderGate.ts: pure silence/too-short gate before audio is ever sent to the
// server. Takes duration and a level reading (RMS or peak) and decides whether the recording is
// worth uploading at all.
import { LIMITS } from '../types.ts';

/** Below this level (0-1 scale), a recording is treated as silence even if long enough. */
export const SILENT_LEVEL_THRESHOLD = 0.02;

export interface RecorderGateInput {
  durationMs: number;
  rmsLevel?: number;
  peakLevel?: number;
  minRecordingSec?: number; // defaults to LIMITS.minRecordingSec
}

export type RecorderGateReason = 'too_short' | 'silent';

export interface RecorderGateResult {
  accepted: boolean;
  reason?: RecorderGateReason;
}

/** Decides whether a recording should be sent to the server, before ever uploading it. */
export function evaluateRecorderGate(input: RecorderGateInput): RecorderGateResult {
  const minSec = input.minRecordingSec ?? LIMITS.minRecordingSec;
  if (input.durationMs / 1000 < minSec) return { accepted: false, reason: 'too_short' };

  const level = input.rmsLevel ?? input.peakLevel;
  if (level !== undefined && level < SILENT_LEVEL_THRESHOLD) return { accepted: false, reason: 'silent' };

  return { accepted: true };
}
