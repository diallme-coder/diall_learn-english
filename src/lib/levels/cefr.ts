// src/lib/levels/cefr.ts: shared CEFR level-ordering helpers.
// Used by placement.ts (staircase movement) and scaffolding.ts (mode selection).

import { CEFR_LEVELS, type CEFRLevel } from '../types.ts';

/** Position of `level` in CEFR_LEVELS (0 = A1 .. 4 = C1). */
export function levelIndex(level: CEFRLevel): number {
  return CEFR_LEVELS.indexOf(level);
}

/** True when `level` is at least as advanced as `min` (e.g. isAtLeast('B1', 'A2') === true). */
export function isAtLeast(level: CEFRLevel, min: CEFRLevel): boolean {
  return levelIndex(level) >= levelIndex(min);
}

/** Negative if a < b, 0 if equal, positive if a > b, in CEFR order. */
export function compareLevels(a: CEFRLevel, b: CEFRLevel): number {
  return levelIndex(a) - levelIndex(b);
}

/** One level up, or null at the ceiling (C1). */
export function nextLevel(level: CEFRLevel): CEFRLevel | null {
  const i = levelIndex(level);
  return i < CEFR_LEVELS.length - 1 ? (CEFR_LEVELS[i + 1] ?? null) : null;
}

/** One level down, or null at the floor (A1). */
export function prevLevel(level: CEFRLevel): CEFRLevel | null {
  const i = levelIndex(level);
  return i > 0 ? (CEFR_LEVELS[i - 1] ?? null) : null;
}
