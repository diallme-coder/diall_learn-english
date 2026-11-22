// src/components/core/LevelBadge.tsx: the small level pill shown on Home and pickers
// (design 03 §1). Pure presentational; no client-only APIs, so no 'use client' needed.
import type { CEFRLevel } from '../../lib/types.ts';
import { t, type StringKey, type UiLangMode } from '../../lib/ui/strings.ts';

export const LEVEL_NAME_KEY: Record<CEFRLevel, StringKey> = {
  A1: 'levelNameA1',
  A2: 'levelNameA2',
  B1: 'levelNameB1',
  B2: 'levelNameB2',
  C1: 'levelNameC1',
};

export default function LevelBadge({ level, mode = 'fr' }: { level: CEFRLevel; mode?: UiLangMode }) {
  return (
    <span className="level-badge">
      <span className="level-badge__code">{level}</span>
      <span>{t(LEVEL_NAME_KEY[level], mode)}</span>
    </span>
  );
}
