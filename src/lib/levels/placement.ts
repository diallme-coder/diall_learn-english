// src/lib/levels/placement.ts: scores a placement quiz into a PlacementResult.
//
// Deviation from the original review note ("confidence:'high' needs >= 2
// answers at the decided level, except at C1"): with a 5-6 question pool
// there is usually only one question per level, so a fixed "2 answers"
// floor at every level is unreachable in practice. Confidence is instead
// based on consistency: one answer at the decided level PLUS a confirmed
// miss at the level immediately above is enough for 'high' (the miss above
// disconfirms a higher level, which is the real signal). At the C1 ceiling,
// where there is no level above to disconfirm, 'high' still requires >= 2
// C1 answers, since that is the only available consistency check there.

import {
  CEFR_LEVELS,
  type CEFRLevel,
  type PlacementAnswer,
  type PlacementQuestion,
  type PlacementResult,
} from '../types.ts';
import { nextLevel } from './cefr.ts';

const SPEAK_CORRECT_THRESHOLD = 0.6; // spokenScore is 0..1
const SPEAK_WEIGHT = 0.5; // 'speak' questions measure reading-aloud, not real level: weighted low
const CHOICE_WEIGHT = 1;
const PASS_ACCURACY = 0.6;

/**
 * The explicit level staircase: one correct answer moves the learner up one
 * level, one incorrect (or 'dont_know') answer moves them down one level.
 * A1 and C1 are the floor and ceiling. This is the transition table an
 * adaptive quiz-runner should follow when picking the next question; scorePlacement
 * itself scores whatever answers it is given, using this only to document
 * the intended staircase and as a sanity bound in tests.
 */
export const PLACEMENT_TRANSITIONS: Readonly<Record<CEFRLevel, { onCorrect: CEFRLevel; onIncorrect: CEFRLevel }>> = {
  A1: { onCorrect: 'A2', onIncorrect: 'A1' },
  A2: { onCorrect: 'B1', onIncorrect: 'A1' },
  B1: { onCorrect: 'B2', onIncorrect: 'A2' },
  B2: { onCorrect: 'C1', onIncorrect: 'B1' },
  C1: { onCorrect: 'C1', onIncorrect: 'B2' },
};

interface LevelTally {
  correctWeight: number;
  totalWeight: number;
}

function emptyTally(): Record<CEFRLevel, LevelTally> {
  const tally = {} as Record<CEFRLevel, LevelTally>;
  for (const level of CEFR_LEVELS) tally[level] = { correctWeight: 0, totalWeight: 0 };
  return tally;
}

function isAnswerCorrect(answer: PlacementAnswer, question: PlacementQuestion): boolean {
  if (answer.kind === 'dont_know') return false;
  if (answer.kind === 'choice' && question.kind === 'choice') {
    return answer.choiceIndex === question.correctIndex;
  }
  if (answer.kind === 'speak' && question.kind === 'speak') {
    return answer.spokenScore >= SPEAK_CORRECT_THRESHOLD;
  }
  return false; // answer/question kind mismatch: never counted as correct
}

function confidenceFor(
  level: CEFRLevel,
  tally: Record<CEFRLevel, LevelTally>,
  missedLevels: ReadonlySet<CEFRLevel>,
): PlacementResult['confidence'] {
  const atDecided = tally[level].totalWeight;
  if (level === 'C1') {
    // No level above C1 to disconfirm: fall back to within-level consistency.
    if (atDecided >= 2) return 'high';
    return atDecided >= 1 ? 'medium' : 'low';
  }
  const above = nextLevel(level);
  const missAbove = above !== null && missedLevels.has(above);
  if (atDecided >= 1 && missAbove) return 'high';
  if (atDecided >= 1) return 'medium';
  return 'low';
}

/**
 * Scores a finished (or partial) set of placement answers against the
 * questions they refer to. `questions` need not be PLACEMENT_QUESTIONS — any
 * caller-supplied pool works, which is how an adaptive quiz-runner driven by
 * PLACEMENT_TRANSITIONS would use this.
 */
export function scorePlacement(
  answers: readonly PlacementAnswer[],
  questions: readonly PlacementQuestion[],
): PlacementResult {
  const byId = new Map(questions.map((q) => [q.id, q] as const));
  const tally = emptyTally();
  const missedLevels = new Set<CEFRLevel>();

  for (const answer of answers) {
    const question = byId.get(answer.questionId);
    if (!question) continue;
    const correct = isAnswerCorrect(answer, question);
    if (!correct) missedLevels.add(question.level);
    // 'dont_know' counts as a miss for the pass/fail chain above, but is
    // excluded from the weighted tally so it never drags accuracy (and so
    // confidence) down beyond what real attempts already show.
    if (answer.kind === 'dont_know') continue;
    const weight = question.kind === 'speak' ? SPEAK_WEIGHT : CHOICE_WEIGHT;
    tally[question.level].totalWeight += weight;
    if (correct) tally[question.level].correctWeight += weight;
  }

  const accuracyByLevel = {} as Record<CEFRLevel, number | null>;
  for (const level of CEFR_LEVELS) {
    const t = tally[level];
    accuracyByLevel[level] = t.totalWeight > 0 ? t.correctWeight / t.totalWeight : null;
  }

  // The level is the highest one with an unbroken >= 0.6 chain from A1
  // through every asked (and scoreable) level below it. If even A1 is not
  // asked or fails, `decided` stays null and we fall back to A1 — this is
  // what gives the A1 fallback when everything is wrong, without a special case.
  let decided: CEFRLevel | null = null;
  let chainIntact = true;
  for (const level of CEFR_LEVELS) {
    const acc = accuracyByLevel[level];
    if (acc === null) continue; // not asked, or answered only with 'dont_know'
    if (chainIntact && acc >= PASS_ACCURACY) {
      decided = level;
    } else {
      chainIntact = false;
    }
  }
  const level: CEFRLevel = decided ?? 'A1';

  return {
    level,
    accuracyByLevel,
    confidence: confidenceFor(level, tally, missedLevels),
    method: 'quiz',
  };
}

/** Used when speaking is unavailable (signed out, mic denied, offline) and the learner picks their own level. */
export function selfSelectPlacement(level: CEFRLevel): PlacementResult {
  const accuracyByLevel = {} as Record<CEFRLevel, number | null>;
  for (const l of CEFR_LEVELS) accuracyByLevel[l] = null;
  return { level, accuracyByLevel, confidence: 'low', method: 'self_select' };
}
