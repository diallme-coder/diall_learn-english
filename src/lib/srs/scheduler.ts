// src/lib/srs/scheduler.ts: a small SM-2 variant for spaced repetition of drill items.
import type { DrillCheckResult, EpochMs, ReviewGrade, SrsCard } from '../types.ts';

const EASE_START = 2.5;
const EASE_FLOOR = 1.3;
const EASE_CEIL = 5; // matches the F validator's accepted range [1.3, 5]
const INTERVAL_CAP_DAYS = 180;
const DAY_MS = 86_400_000;
const AGAIN_INTERVAL_DAYS = 10 / (24 * 60); // 10 minutes
const HARD_FIRST_REP_INTERVAL_DAYS = 0.5;   // critical fix: not 0

function clampEase(ease: number): number {
  return Math.min(EASE_CEIL, Math.max(EASE_FLOOR, ease));
}

function clampInterval(days: number): number {
  return Math.min(INTERVAL_CAP_DAYS, Math.max(0, days));
}

export function newCard(itemId: string, nowMs: EpochMs): SrsCard {
  return { itemId, ease: EASE_START, intervalDays: 0, repetitions: 0, lapses: 0, dueAt: nowMs, lastReviewedAt: null };
}

export function isDue(card: SrsCard, nowMs: EpochMs): boolean {
  return card.dueAt <= nowMs;
}

export function review(card: SrsCard, grade: ReviewGrade, nowMs: EpochMs): SrsCard {
  let ease = card.ease;
  let intervalDays: number;
  let repetitions = card.repetitions;
  let lapses = card.lapses;

  if (grade === 'again') {
    repetitions = 0;
    lapses = card.lapses + 1;
    ease = clampEase(card.ease - 0.2);
    intervalDays = AGAIN_INTERVAL_DAYS;
  } else if (grade === 'hard') {
    ease = clampEase(card.ease - 0.15);
    intervalDays = card.repetitions === 0 ? HARD_FIRST_REP_INTERVAL_DAYS : card.intervalDays * 1.2;
  } else if (grade === 'good') {
    repetitions = card.repetitions + 1;
    if (card.repetitions === 0) intervalDays = 1;
    else if (card.repetitions === 1) intervalDays = 3;
    else intervalDays = card.intervalDays * card.ease;
  } else {
    // 'easy'
    repetitions = card.repetitions + 1;
    ease = clampEase(card.ease + 0.15);
    const base = card.intervalDays > 0 ? card.intervalDays : card.repetitions === 0 ? 1 : 3;
    intervalDays = base * card.ease * 1.3;
  }

  intervalDays = clampInterval(intervalDays);

  return {
    itemId: card.itemId,
    ease,
    intervalDays,
    repetitions,
    lapses,
    dueAt: nowMs + intervalDays * DAY_MS,
    lastReviewedAt: nowMs,
  };
}

export function gradeFromResult(result: DrillCheckResult, durationMs: number): ReviewGrade {
  if (result.verdict === 'incorrect') return 'again';
  if (result.verdict === 'confirm') return 'hard';
  // verdict === 'correct'
  if (durationMs > 15_000) return 'hard';
  if (durationMs < 4_000) return 'easy';
  return 'good';
}
