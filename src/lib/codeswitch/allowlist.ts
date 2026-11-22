// src/lib/codeswitch/allowlist.ts
//
// Terms that must NEVER produce a DetectedSpan/SideCard on their own,
// because they are loanwords, English words that happen to also be French,
// or proper nouns. detector.ts consults these before trying FR_LEXICON.
//
// Resolution notes (docs/PLAN.md, Unit C):
// - HOMOGRAPHS holds only strings that are themselves valid, differently
//   meant English words (so an English sentence containing them is not,
//   by itself, evidence of code-switching). 'rester' is deliberately NOT
//   here: it is not an English word, it is a false friend (see lexicon.ts),
//   so leaving it out of this list is correct, not an oversight.
// - 'genre' is deliberately NOT here either. Its English-noun sense is
//   recognised structurally by detector.ts (adjacency to a determiner/noun
//   like "a"/"the"/"music"), not by allowlisting the word outright, because
//   "genre" is ALSO a French filler ("it was genre crazy") that must still
//   be caught. Putting it in both files would create two classification
//   paths for the same word; it lives in lexicon.ts only.

// (a) Loanwords: borrowed into English, or so ambiguous (café usage) that
// flagging them creates more noise than help.
export const LOANWORDS: readonly string[] = [
  'croissant', 'café', 'déjà vu', 'rendez-vous', 'cliché', 'résumé', 'ballet',
  'chic', 'bourgeois', 'fiancé', 'fiancée', 'naive',
];

// (b) English homographs: French words spelled identically to a real,
// differently meant English word. Also present in lexicon.ts (so a card can
// still be built), but suppressed by default; detector.ts re-admits one of
// these only when it sits next to another already-confirmed French span.
export const HOMOGRAPHS: readonly string[] = [
  'pain', 'chat', 'coin', 'four', 'car', 'plus', 'sale', 'son', 'main', 'sort',
  'attend', 'place',
];

// Words a "genre"-style adjacency check treats as the ordinary English noun
// use of "genre" (a music/film genre), so it is never flagged there. This is
// not an allowlist entry for "genre" itself (see note above) — it only feeds
// detector.ts's local disambiguation.
export const ENGLISH_GENRE_PRECEDERS: readonly string[] = [
  'a', 'an', 'the', 'this', 'that', 'music', 'film', 'movie', 'favorite', 'favourite', 'genre',
];

// (c) Proper nouns: a capitalised mid-sentence token is never flagged
// (detector.ts applies this structurally; nothing to list here).

export function isLoanword(normalizedToken: string): boolean {
  return LOANWORDS.includes(normalizedToken);
}

export function isHomograph(normalizedToken: string): boolean {
  return HOMOGRAPHS.includes(normalizedToken);
}
