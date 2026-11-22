// src/lib/pronunciation/tips.ts
//
// Given a TrapId (and the word it was flagged on), returns the French
// mouth-placement tip to show. The base tip always comes from the trap
// catalog; for a non-sensitive minimal pair matching `word` we add a short,
// concrete example. A sensitive pair never has its `confusedWith` echoed
// here, even as an example — see sensitive.ts.

import type { TrapId } from '../types.ts';
import { getTrap } from './traps.ts';

export function tipFor(trapId: TrapId, word: string): string {
  const trap = getTrap(trapId);
  const normalized = word.trim().toLowerCase();
  const pair = trap.minimalPairs.find((p) => p.target.toLowerCase() === normalized);

  if (pair && !pair.sensitive) {
    return `${trap.mouthTipFr} Exemple : « ${pair.target} » ne doit pas devenir « ${pair.confusedWith} ».`;
  }
  return trap.mouthTipFr;
}
