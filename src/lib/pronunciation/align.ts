// src/lib/pronunciation/align.ts
//
// Word-level alignment between expected reference tokens and the heard
// `TranscriptWord[]`, using a simple Levenshtein/edit-distance sequence
// alignment. Produces, in order, one entry per expected word (match,
// substitute or delete) plus insertion entries for extra heard words that
// matched nothing expected.

import type { TranscriptWord } from '../types.ts';

export type AlignOp = 'match' | 'substitute' | 'delete' | 'insert';

export interface AlignedWord {
  /** Index into the `expected` array, or null for an insertion. */
  expectedIndex: number | null;
  expected: string | null;
  /** The heard word, or null for a deletion. */
  heard: TranscriptWord | null;
  op: AlignOp;
}

function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-z']/g, '');
}

/**
 * Aligns `expected` (reference tokens, in order) against `heard`
 * (transcript words, in order) and returns one AlignedWord per expected
 * token, interleaved with insertions for unmatched heard words, all in
 * heard/expected order.
 */
export function alignWords(expected: readonly string[], heard: readonly TranscriptWord[]): AlignedWord[] {
  const n = expected.length;
  const m = heard.length;
  const expNorm = expected.map(normalize);
  const heardNorm = heard.map((w) => normalize(w.text));

  // dp[i][j] = edit distance between expected[0..i) and heard[0..j)
  const dp: number[][] = [];
  for (let i = 0; i <= n; i++) dp.push(new Array<number>(m + 1).fill(0));
  const row0 = dp[0];
  if (row0) for (let j = 0; j <= m; j++) row0[j] = j;
  for (let i = 0; i <= n; i++) {
    const row = dp[i];
    if (row) row[0] = i;
  }

  for (let i = 1; i <= n; i++) {
    const row = dp[i];
    const prevRow = dp[i - 1];
    if (!row || !prevRow) continue;
    for (let j = 1; j <= m; j++) {
      const same = expNorm[i - 1] === heardNorm[j - 1];
      const subCost = (prevRow[j - 1] ?? 0) + (same ? 0 : 1);
      const delCost = (prevRow[j] ?? 0) + 1;
      const insCost = (row[j - 1] ?? 0) + 1;
      row[j] = Math.min(subCost, delCost, insCost);
    }
  }

  const result: AlignedWord[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const row = dp[i];
    const prevRow = dp[i - 1];
    const cur = row?.[j] ?? 0;
    if (i > 0 && j > 0 && prevRow) {
      const same = expNorm[i - 1] === heardNorm[j - 1];
      const diagCost = (prevRow[j - 1] ?? 0) + (same ? 0 : 1);
      if (cur === diagCost) {
        result.push({
          expectedIndex: i - 1,
          expected: expected[i - 1] ?? null,
          heard: heard[j - 1] ?? null,
          op: same ? 'match' : 'substitute',
        });
        i -= 1;
        j -= 1;
        continue;
      }
    }
    if (i > 0 && prevRow && cur === (prevRow[j] ?? 0) + 1) {
      result.push({ expectedIndex: i - 1, expected: expected[i - 1] ?? null, heard: null, op: 'delete' });
      i -= 1;
      continue;
    }
    // Insertion: an extra heard word with no corresponding expected word.
    result.push({ expectedIndex: null, expected: null, heard: heard[j - 1] ?? null, op: 'insert' });
    j -= 1;
  }

  result.reverse();
  return result;
}
