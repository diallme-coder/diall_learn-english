// src/lib/drills/normalize.ts: normalize a typed/spoken drill answer for comparison.
// Lowercases, trims, strips leading/trailing punctuation, collapses internal whitespace.
// Expands nothing: contractions ("i'm") stay as-is because acceptedEn lists both the
// contracted and expanded forms explicitly.

const BOUNDARY_PUNCTUATION = /^["'“”‘’.,!?¿¡;:\s]+|["'“”‘’.,!?¿¡;:\s]+$/g;

export function normalizeAnswer(raw: string): string {
  return raw
    .replace(/[‘’]/g, "'") // curly single quotes/apostrophes -> straight, so contractions compare equal
    .toLowerCase()
    .trim()
    .replace(BOUNDARY_PUNCTUATION, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(normalized: string): string[] {
  return normalized.length === 0 ? [] : normalized.split(' ');
}
