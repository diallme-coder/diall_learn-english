// src/lib/pronunciation/lexicon.ts
//
// A small word -> TrapId[] helper built from the trap catalog itself, so it
// never drifts from `traps.ts`. Used by `scorer.ts` to count how many
// reference words were even "at risk" for a given trap (trapCounts.attempts).
//
// Only non-sensitive words become lexicon keys: the sensitive pair's
// `confusedWith` ("bitch") is deliberately excluded.

import type { TrapId } from '../types.ts';
import { TRAPS } from './traps.ts';

function normalize(word: string): string {
  return word.trim().toLowerCase();
}

function buildLexicon(): Map<string, TrapId[]> {
  const map = new Map<string, Set<TrapId>>();
  const add = (word: string, trapId: TrapId) => {
    const key = normalize(word);
    const existing = map.get(key);
    if (existing) existing.add(trapId);
    else map.set(key, new Set([trapId]));
  };

  for (const trap of TRAPS) {
    for (const word of trap.practiceWords) add(word, trap.id);
    for (const pair of trap.minimalPairs) {
      add(pair.target, trap.id);
      if (!pair.sensitive) add(pair.confusedWith, trap.id);
    }
  }

  const frozen = new Map<string, TrapId[]>();
  for (const [key, set] of map) frozen.set(key, [...set]);
  return frozen;
}

const LEXICON: ReadonlyMap<string, TrapId[]> = buildLexicon();

/** Returns the TrapIds a word is known to be a practice/confusion case for. */
export function trapsInWord(word: string): TrapId[] {
  return LEXICON.get(normalize(word)) ?? [];
}
