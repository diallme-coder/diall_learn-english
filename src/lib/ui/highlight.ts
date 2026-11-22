// src/lib/ui/highlight.ts: pure mapping from a word's score status to a non-colour-dependent
// highlight descriptor (design 04 §6, 05 §4). Colour is never the only signal: pattern + glyph +
// an aria label always carry the meaning too.
import type { WordScoreStatus } from '../types.ts';
import { t, type UiLangMode } from './strings.ts';

export type HighlightPattern = 'dotted-underline' | 'wavy-underline' | 'double-underline' | 'dashed-underline';
export type HighlightGlyph = 'check' | 'tilde' | 'cross' | null;

export interface HighlightDescriptor {
  colorToken: string;
  pattern: HighlightPattern;
  bold: boolean;
  glyph: HighlightGlyph;
  ariaLabel: string;
}

const DESCRIPTORS: Record<WordScoreStatus, Omit<HighlightDescriptor, 'ariaLabel'>> = {
  ok: { colorToken: 'hl-ok', pattern: 'dotted-underline', bold: false, glyph: 'check' },
  warn: { colorToken: 'hl-warn', pattern: 'wavy-underline', bold: false, glyph: 'tilde' },
  error: { colorToken: 'hl-error', pattern: 'double-underline', bold: true, glyph: 'cross' },
  // unsure is always neutral and NEVER uses the error/red color token, and has no glyph.
  unsure: { colorToken: 'hl-unsure', pattern: 'dashed-underline', bold: false, glyph: null },
};

const ARIA_KEY: Record<WordScoreStatus, 'highlightOk' | 'highlightWarn' | 'highlightError' | 'highlightUnsure'> = {
  ok: 'highlightOk',
  warn: 'highlightWarn',
  error: 'highlightError',
  unsure: 'highlightUnsure',
};

/** Returns the full non-colour-dependent descriptor for a word's score status. */
export function highlightForStatus(status: WordScoreStatus, mode: UiLangMode = 'fr'): HighlightDescriptor {
  const base = DESCRIPTORS[status];
  return { ...base, ariaLabel: t(ARIA_KEY[status], mode) };
}

/** `word, presque`-style combined label, matching design 05 §3's `aria-label` example. */
export function highlightAriaLabel(word: string, status: WordScoreStatus, mode: UiLangMode = 'fr'): string {
  return `${word}, ${t(ARIA_KEY[status], mode)}`;
}
