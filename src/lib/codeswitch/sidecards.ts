// src/lib/codeswitch/sidecards.ts
//
// Turns DetectedSpans into the SideCards the UI actually renders: "Tu as
// dit 'X' -> en anglais, dis : Y". Capped at LIMITS.maxSideCardsPerUtterance
// (3), sorted by confidence. A span with confidence < 0.7, or with no
// matching FR_LEXICON entry (so there is nothing trustworthy to suggest),
// never becomes a card — detector.ts turns that into `needsClarification`
// instead of guessing.

import type { DetectedSpan, LexiconEntry, SideCard } from '../types.ts';
import { LIMITS } from '../types.ts';
import { FR_LEXICON } from './lexicon.ts';
import { normalizeWithMap } from './normalize.ts';

const BY_NORMALIZED_FR = new Map<string, LexiconEntry>();
for (const entry of FR_LEXICON) {
  BY_NORMALIZED_FR.set(normalizeWithMap(entry.fr).normalized, entry);
}

/** Looks up the FR_LEXICON entry (if any) matching a span's surface text. */
export function lookupLexiconEntry(spanText: string): LexiconEntry | undefined {
  return BY_NORMALIZED_FR.get(normalizeWithMap(spanText).normalized);
}

export function buildSideCards(utterance: string, spans: readonly DetectedSpan[]): SideCard[] {
  void utterance; // span.text already carries the matched slice of utterance
  const candidates: SideCard[] = [];
  const byConfidence = [...spans].sort((a, b) => b.confidence - a.confidence || a.start - b.start);
  for (const span of byConfidence) {
    if (candidates.length >= LIMITS.maxSideCardsPerUtterance) break;
    if (span.confidence < 0.7) continue;
    const entry = lookupLexiconEntry(span.text);
    if (!entry) continue;
    candidates.push({
      id: `${span.start}-${span.end}`,
      frenchSpan: span.text,
      englishSuggestion: entry.en,
      note: entry.note ?? '',
      example: entry.example,
      span: { start: span.start, end: span.end },
      confidence: span.confidence,
    });
  }
  return candidates.sort((a, b) => a.span.start - b.span.start);
}
