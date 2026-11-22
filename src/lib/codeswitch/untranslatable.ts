// src/lib/codeswitch/untranslatable.ts
//
// French discourse words with no clean 1:1 English translation. When one of
// these appears, detector.ts/sidecards.ts set `needsClarification: true`
// instead of building a card with a guessed translation (a wrong guess is
// worse than asking).
//
// These are disjoint from FR_LEXICON's fillers (lexicon.ts): 'genre', 'euh',
// 'bref', 'enfin', 'bah' and 'ben' DO have a workable English rendering and
// so keep a single classification path there. The words below genuinely
// don't.

export interface UntranslatableEntry {
  fr: string;
  // Short note (French) on why it resists translation and how to handle it.
  handlingNoteFr: string;
}

// Rich internal form (term + handling note). index.ts's contract (§6) only
// exposes the plain term list as `UNTRANSLATABLE: readonly string[]`, which
// is derived from this below.
export const UNTRANSLATABLE_ENTRIES: readonly UntranslatableEntry[] = [
  { fr: 'machin', handlingNoteFr: "Mot passe-partout pour une chose non nommée ; demander « what do you mean? » plutôt que deviner." },
  { fr: 'truc', handlingNoteFr: "Comme 'machin' ; pas de traduction unique, demander une clarification." },
  { fr: 'bidule', handlingNoteFr: "Comme 'machin'/'truc' ; demander une clarification." },
  { fr: 'bon ben', handlingNoteFr: "Marqueur de transition sans équivalent unique ; ignorer plutôt que traduire." },
  { fr: 'comment dire', handlingNoteFr: "Hésitation pendant la recherche d'un mot ; ne pas traduire littéralement." },
  { fr: 'comme qui dirait', handlingNoteFr: "Approximation familière ; demander une clarification plutôt que deviner." },
];

/** Plain term list, matching the `src/lib/codeswitch/index.ts` contract. */
export const UNTRANSLATABLE: readonly string[] = UNTRANSLATABLE_ENTRIES.map((e) => e.fr);

const UNTRANSLATABLE_SET = new Set(UNTRANSLATABLE);

export function isUntranslatable(normalizedToken: string): boolean {
  return UNTRANSLATABLE_SET.has(normalizedToken);
}

// Some entries ('bon ben', 'comment dire', 'comme qui dirait') are phrases,
// not single tokens. This checks whether any entry occurs as a substring of
// an already-normalized (lowercased, NFC, apostrophe-folded) text.
export function containsUntranslatable(normalizedText: string): boolean {
  for (const term of UNTRANSLATABLE) {
    if (normalizedText.includes(term)) return true;
  }
  return false;
}
