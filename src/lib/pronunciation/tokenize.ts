// src/lib/pronunciation/tokenize.ts
//
// Tokenizes reference text into words for alignment/scoring while
// preserving exact character offsets into the ORIGINAL string. Punctuation
// is stripped for matching purposes, but a token's `start`/`end` slice the
// original text back to exactly the word (contractions like "don't" keep
// their internal apostrophe; surrounding commas/periods are excluded).

export interface OffsetToken {
  token: string;
  start: number;
  end: number;
}

// Letters plus internal apostrophes (contractions), e.g. "don't", "it's".
const TOKEN_RE = /[A-Za-z]+(?:'[A-Za-z]+)*/g;

export function tokenizeWithOffsets(text: string): OffsetToken[] {
  const out: OffsetToken[] = [];
  for (const match of text.matchAll(TOKEN_RE)) {
    const token = match[0];
    if (token === undefined) continue;
    const start = match.index;
    out.push({ token, start, end: start + token.length });
  }
  return out;
}
