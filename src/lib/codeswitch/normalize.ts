// src/lib/codeswitch/normalize.ts
//
// String normalization for matching (NFC, apostrophe folding, lowercasing)
// that keeps an index map back to the ORIGINAL, un-normalized string. Every
// DetectedSpan/SideCard.span offset in this unit refers to the original
// string; normalization never drifts those offsets, even across decomposed
// vs. composed Unicode input (NFD vs NFC accents).

export interface NormalizedText {
  normalized: string;
  // originalStart[i] / originalEnd[i]: the original-string [start, end)
  // range (UTF-16 code unit indices) whose normalization produced
  // normalized[i]. One entry per code unit of `normalized`.
  originalStart: readonly number[];
  originalEnd: readonly number[];
}

// Curly/backtick apostrophe variants folded to a plain "'" for matching.
const APOSTROPHES = /[‘’ʼ´`]/g;

function foldApostrophes(s: string): string {
  return s.replace(APOSTROPHES, "'");
}

/**
 * Normalizes `original` (NFC + apostrophe folding + lowercasing) while
 * recording, for every code unit of the result, which [start, end) slice of
 * the ORIGINAL string produced it. Normalization is done per Unicode
 * grapheme cluster, so composed/decomposed accents on the same character
 * (e.g. "é" as one code point vs. "e" + combining acute) both map back to
 * that character's own original offsets, never to a neighbour's.
 */
export function normalizeWithMap(original: string): NormalizedText {
  const segmenter = new Intl.Segmenter('fr', { granularity: 'grapheme' });
  const normalizedChars: string[] = [];
  const originalStart: number[] = [];
  const originalEnd: number[] = [];

  for (const { segment, index } of segmenter.segment(original)) {
    const origStart = index;
    const origEnd = index + segment.length;
    const piece = foldApostrophes(segment.normalize('NFC')).toLowerCase();
    for (const ch of piece) {
      normalizedChars.push(ch);
      originalStart.push(origStart);
      originalEnd.push(origEnd);
    }
  }

  return { normalized: normalizedChars.join(''), originalStart, originalEnd };
}

/**
 * Maps a [start, end) range in the normalized string (as produced by
 * `normalizeWithMap`) back to the matching [start, end) range in the
 * ORIGINAL string. `end` is exclusive, matching the input convention.
 */
export function mapRangeToOriginal(
  map: NormalizedText,
  start: number,
  end: number,
): { start: number; end: number } {
  const len = map.originalStart.length;
  if (len === 0 || start >= end) {
    const at = Math.max(0, Math.min(start, len - 1));
    const orig = len === 0 ? 0 : (map.originalStart[at] ?? 0);
    return { start: orig, end: orig };
  }
  const clampedStart = Math.max(0, Math.min(start, len - 1));
  const clampedEnd = Math.max(0, Math.min(end - 1, len - 1));
  const origStart = map.originalStart[clampedStart] ?? 0;
  const origEnd = map.originalEnd[clampedEnd] ?? origStart;
  return { start: origStart, end: origEnd };
}
