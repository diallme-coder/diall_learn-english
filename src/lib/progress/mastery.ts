// src/lib/progress/mastery.ts: EMA-based mastery update for VocabularyEntry.mastery.
// Assumed range: [0, 1] (VocabularyEntry.mastery is a plain `number`; 0 = never seen correct,
// 1 = always correct). G's SQL `record_vocab` must use the same formula and alpha.
import { MASTERY_EMA_ALPHA } from '../types.ts';

export function masteryAfter(prev: number, correct: boolean, alpha: number = MASTERY_EMA_ALPHA): number {
  const next = prev + alpha * ((correct ? 1 : 0) - prev);
  return Math.min(1, Math.max(0, next));
}
