// src/lib/ui/recorderMime.ts: pure pick of a supported MediaRecorder mime type. The
// `isTypeSupported` predicate is injected so this is testable without a real browser.
import type { AllowedAudioMime } from '../types.ts';
import { isAllowedAudioMime } from '../types.ts';

/** Preference order per design 04 §7 item 6: webm/opus, then mp4, then ogg. */
export const DEFAULT_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const;

function baseType(mime: string): string {
  const semi = mime.indexOf(';');
  return semi === -1 ? mime : mime.slice(0, semi);
}

/**
 * Picks the first candidate (in order) that `isTypeSupported` accepts AND whose base type is in
 * `LIMITS.allowedAudioMime`. Returns the full candidate string (with any `;codecs=` suffix), or
 * null if none qualify.
 */
export function pickRecorderMime(
  isTypeSupported: (mime: string) => boolean,
  candidates: readonly string[] = DEFAULT_MIME_CANDIDATES,
): string | null {
  for (const candidate of candidates) {
    if (isAllowedAudioMime(baseType(candidate)) && isTypeSupported(candidate)) return candidate;
  }
  return null;
}

/** The allowed-audio-mime base type of a picked candidate, or null. */
export function pickRecorderBaseMime(
  isTypeSupported: (mime: string) => boolean,
  candidates: readonly string[] = DEFAULT_MIME_CANDIDATES,
): AllowedAudioMime | null {
  const picked = pickRecorderMime(isTypeSupported, candidates);
  if (picked === null) return null;
  const base = baseType(picked);
  return isAllowedAudioMime(base) ? base : null;
}
