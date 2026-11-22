// src/lib/pronunciation/scorer.ts
//
// scorePronunciation({ referenceText, transcript }) -> PronunciationReport.
//
// This is an intelligibility check, not a pronunciation grader: the only
// signal available is ASR text plus a coarse per-word confidence, so
// `stress_misplaced` and `weak_forms` (which need prosody, not text) are
// never emitted here — they exist only as practice content in traps.ts.
//
// Scoring rules (binding; see docs/PLAN.md Unit B):
// - A missing `confidence` is treated as SCORE_THRESHOLDS.defaultConfidence
//   (0.75). Such a word is never `unsure`, and never scores a perfect 100
//   automatically.
// - `stress_misplaced` is NEVER inferred from confidence/text alone; it is
//   not wired into detectSubstitutionTrap at all.
// - `error` is only produced when the reference has
//   <= SCORE_THRESHOLDS.isolatedWordMaxTokens tokens (isolated word / pair
//   drill). In longer sentences the same signal yields `warn` + the trapId.
// - If the deletion ratio exceeds SCORE_THRESHOLDS.maxDeletionRatio, the
//   whole report becomes overall: null, every word `unsure`.
// - A sensitive heard token is never echoed: WordScore.heard becomes null,
//   but the correction tip is still shown.

import type {
  PronunciationScoreRequest,
  PronunciationReport,
  WordScore,
  WordScoreStatus,
  TrapCount,
  TrapId,
} from '../types.ts';
import { SCORE_THRESHOLDS, TRAP_IDS } from '../types.ts';
import { tokenizeWithOffsets, type OffsetToken } from './tokenize.ts';
import { alignWords } from './align.ts';
import { TRAPS, getTrap } from './traps.ts';
import { isSensitiveWord } from './sensitive.ts';
import { trapsInWord } from './lexicon.ts';
import { tipFor } from './tips.ts';

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z']/g, '');
}

// th > h > vowel, per the plan. Stress/weak-form ids are intentionally
// absent: the scorer never flags them.
const PRIMARY_TIP_PRIORITY: readonly TrapId[] = [
  'th_as_s', 'th_as_f', 'th_as_t', 'dh_as_z', 'dh_as_d',
  'h_dropped', 'h_inserted',
  'ih_vs_iy', 'uh_vs_uw',
];

const SCOREABLE_TRAP_IDS: readonly TrapId[] = TRAP_IDS.filter(
  (id) => getTrap(id).category !== 'stress_rhythm',
);

function detectSubstitutionTrap(expected: string, heard: string): TrapId | null {
  const expNorm = normalizeWord(expected);
  const heardNorm = normalizeWord(heard);

  // Known confusions straight from the catalog (covers the sensitive pair too).
  for (const trap of TRAPS) {
    for (const pair of trap.minimalPairs) {
      if (normalizeWord(pair.target) === expNorm && normalizeWord(pair.confusedWith) === heardNorm) {
        return trap.id;
      }
    }
  }

  // Generic phoneme-substitution heuristics for cases not in the catalog.
  if (expNorm.length > 2 && expNorm.startsWith('th')) {
    const rest = expNorm.slice(2);
    if (heardNorm === `s${rest}`) return 'th_as_s';
    if (heardNorm === `f${rest}`) return 'th_as_f';
    if (heardNorm === `t${rest}`) return 'th_as_t';
    if (heardNorm === `z${rest}`) return 'dh_as_z';
    if (heardNorm === `d${rest}`) return 'dh_as_d';
  }
  if (expNorm.length > 1 && expNorm.startsWith('h') && heardNorm === expNorm.slice(1)) {
    return 'h_dropped';
  }
  if (heardNorm.length > 1 && heardNorm.startsWith('h') && expNorm === heardNorm.slice(1)) {
    return 'h_inserted';
  }
  return null;
}

function levenshtein(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
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
    const prev = dp[i - 1];
    if (!row || !prev) continue;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min((prev[j - 1] ?? 0) + cost, (prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1);
    }
  }
  return dp[n]?.[m] ?? Math.max(n, m);
}

function computeOverall(words: readonly WordScore[]): number | null {
  const scoreable = words.filter((w) => w.status !== 'unsure');
  if (scoreable.length === 0) return null;
  const sum = scoreable.reduce((acc, w) => acc + w.score, 0);
  return Math.round(sum / scoreable.length);
}

function computePrimaryTip(words: readonly WordScore[]): PronunciationReport['primaryTip'] {
  for (const trapId of PRIMARY_TIP_PRIORITY) {
    const hit = words.find(
      (w) => w.trapIds.includes(trapId) && (w.status === 'warn' || w.status === 'error'),
    );
    if (hit) {
      return { wordIndex: hit.index, trapId, tipFr: tipFor(trapId, hit.expected) };
    }
  }
  return null;
}

function buildTrapCounts(tokens: readonly OffsetToken[], words: readonly WordScore[]): TrapCount[] {
  const counts: TrapCount[] = [];
  for (const trapId of SCOREABLE_TRAP_IDS) {
    const attempts = tokens.filter((t) => trapsInWord(t.token).includes(trapId)).length;
    const errors = words.filter((w) => w.trapIds.includes(trapId)).length;
    if (attempts > 0 || errors > 0) counts.push({ trapId, errors, attempts });
  }
  return counts;
}

export function scorePronunciation(req: PronunciationScoreRequest): PronunciationReport {
  const { referenceText, transcript } = req;
  const tokens = tokenizeWithOffsets(referenceText);
  const expectedWords = tokens.map((t) => t.token);
  const aligned = alignWords(expectedWords, transcript.words)
    .filter((a) => a.expectedIndex !== null)
    .sort((a, b) => (a.expectedIndex ?? 0) - (b.expectedIndex ?? 0));

  const isolated = tokens.length <= SCORE_THRESHOLDS.isolatedWordMaxTokens;

  const words: WordScore[] = [];
  let deletionCount = 0;

  for (const entry of aligned) {
    const idx = entry.expectedIndex;
    if (idx === null) continue;
    const tok = tokens[idx];
    if (!tok) continue;
    const expected = tok.token;

    if (entry.heard === null) {
      deletionCount += 1;
      words.push({
        index: idx,
        expected,
        charStart: tok.start,
        charEnd: tok.end,
        heard: null,
        score: 0,
        status: isolated ? 'error' : 'warn',
        trapIds: [],
      });
      continue;
    }

    const heardWord = entry.heard;
    const heardText = heardWord.text;
    let score: number;
    let status: WordScoreStatus;
    let trapIds: TrapId[] = [];

    if (entry.op === 'match') {
      const confidence = heardWord.confidence ?? SCORE_THRESHOLDS.defaultConfidence;
      score = Math.round(100 * confidence);
      if (confidence < SCORE_THRESHOLDS.minConfidence) {
        status = 'unsure';
      } else {
        status = score >= SCORE_THRESHOLDS.ok ? 'ok' : 'warn';
      }
    } else {
      const knownTrap = detectSubstitutionTrap(expected, heardText);
      if (knownTrap) {
        trapIds = [knownTrap];
        score = isolated ? 40 : 60;
        status = isolated ? 'error' : 'warn';
      } else {
        const dist = levenshtein(normalizeWord(expected), normalizeWord(heardText));
        if (dist <= 1) {
          score = 65;
          status = 'warn';
        } else {
          score = isolated ? 20 : 30;
          status = isolated ? 'error' : 'warn';
        }
      }
    }

    const tipFr = trapIds[0] !== undefined ? tipFor(trapIds[0], expected) : undefined;
    const sensitiveHeard = isSensitiveWord(heardText);

    words.push({
      index: idx,
      expected,
      charStart: tok.start,
      charEnd: tok.end,
      heard: sensitiveHeard ? null : heardText,
      score,
      status,
      trapIds,
      tipFr,
      startSec: heardWord.startSec,
      endSec: heardWord.endSec,
    });
  }

  const deletionRatio = tokens.length > 0 ? deletionCount / tokens.length : 0;
  if (deletionRatio > SCORE_THRESHOLDS.maxDeletionRatio) {
    const unsureWords: WordScore[] = words.map((w) => ({ ...w, status: 'unsure' }));
    return {
      referenceText,
      words: unsureWords,
      overall: null,
      primaryTip: null,
      trapCounts: buildTrapCounts(tokens, unsureWords),
    };
  }

  return {
    referenceText,
    words,
    overall: computeOverall(words),
    primaryTip: computePrimaryTip(words),
    trapCounts: buildTrapCounts(tokens, words),
  };
}
