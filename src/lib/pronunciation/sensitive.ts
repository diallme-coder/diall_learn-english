// src/lib/pronunciation/sensitive.ts
//
// Everything that keeps the one sensitive minimal pair (beach/bitch) out of
// places it should never reach directly: catalogs, drills, TTS, and random
// content. The rude word itself is never exposed by this module except
// through `revealConfusedWith(pair, optIn: true)` — an explicit opt-in the
// caller must pass, mirroring the design's "Entendre la différence" tap.

import type { MinimalPair } from '../types.ts';

function normalize(word: string): string {
  return word.trim().toLowerCase();
}

// Small, explicit list. Only the rude counterpart of a sensitive minimal
// pair belongs here — never the target word (e.g. "beach" is not sensitive).
const SENSITIVE_WORDS = new Set<string>(['bitch']);

export function isSensitiveWord(word: string): boolean {
  return SENSITIVE_WORDS.has(normalize(word));
}

/** Drops any MinimalPair flagged `sensitive` from a list used for display/TTS/drills. */
export function filterSensitivePairs(pairs: readonly MinimalPair[]): MinimalPair[] {
  return pairs.filter((pair) => !pair.sensitive);
}

/** Drops any sensitive word from a flat word list (practice words, drill pools, etc.). */
export function filterSensitiveWords(words: readonly string[]): string[] {
  return words.filter((word) => !isSensitiveWord(word));
}

export interface SensitiveTapToReveal {
  sensitive: true;
  /** French, tap-to-reveal note. Never contains the rude word itself. */
  noteFr: string;
}

/**
 * Returns the tap-to-reveal note for a sensitive pair, or null when the
 * pair is not sensitive. The note never contains `pair.confusedWith`.
 */
export function tapToRevealNote(pair: MinimalPair): SensitiveTapToReveal | null {
  if (!pair.sensitive) return null;
  return {
    sensitive: true,
    noteFr:
      `Attention : un /ɪ/ trop court peut changer le mot en une insulte. ` +
      `Entraîne-toi sur « ${pair.target} » avec le /iː/ long.`,
  };
}

/**
 * The only way to obtain the text of a sensitive `confusedWith` word — for
 * display or for TTS. Requires an explicit `optIn: true` from the caller
 * (e.g. an explicit "Entendre la différence" tap). For a non-sensitive
 * pair, `confusedWith` is returned unconditionally.
 */
export function revealConfusedWith(pair: MinimalPair, optIn: boolean): string | null {
  if (!pair.sensitive) return pair.confusedWith;
  return optIn ? pair.confusedWith : null;
}
