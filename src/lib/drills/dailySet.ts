// src/lib/drills/dailySet.ts: buildDailySet assembles the day's micro-drill queue.
// Pure and deterministic: given the same cards/items/now/opts it always returns the same set.
import { CEFR_LEVELS, DAILY_DRILL_BUDGET_SEC, type CEFRLevel, type DailySet, type DrillItem, type EpochMs, type SrsCard } from '../types.ts';

export interface BuildDailySetOptions {
  budgetSec?: number;     // default DAILY_DRILL_BUDGET_SEC (120)
  secondsPerItem?: number; // default 16 -> ~7-8 items fit in 120s
  newPerDay?: number;      // default: fills the whole budget on day 1 (no cards yet), else 3
  level?: CEFRLevel;       // when set, new items are capped at or below this level
  tzOffsetMin?: number;    // minutes to add to UTC to get local time, for dateKey
}

function levelRank(level: CEFRLevel): number {
  return CEFR_LEVELS.indexOf(level);
}

function dateKeyFor(nowMs: EpochMs, tzOffsetMin: number): string {
  const d = new Date(nowMs + tzOffsetMin * 60_000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildDailySet(
  cards: readonly SrsCard[],
  items: readonly DrillItem[],
  nowMs: EpochMs,
  opts: BuildDailySetOptions = {},
): DailySet {
  const budgetSec = opts.budgetSec ?? DAILY_DRILL_BUDGET_SEC;
  const secondsPerItem = opts.secondsPerItem ?? 16;
  const capacity = Math.max(0, Math.floor(budgetSec / secondsPerItem));

  const cardByItemId = new Map(cards.map((c) => [c.itemId, c] as const));

  // 1) Due reviews, most overdue first.
  const dueSorted = [...cards].filter((c) => c.dueAt <= nowMs).sort((a, b) => a.dueAt - b.dueAt);
  const dueIds = dueSorted.slice(0, capacity).map((c) => c.itemId);
  let remaining = capacity - dueIds.length;

  // 2) New items (no card yet), at or below the requested level, capped by newPerDay.
  //    Day 1 (no cards at all) fills the remaining budget instead of the usual cap of 3.
  const newPerDay = opts.newPerDay ?? (cards.length === 0 ? capacity : 3);
  const newCandidates = items.filter(
    (it) => !cardByItemId.has(it.id) && (opts.level === undefined || levelRank(it.level) <= levelRank(opts.level)),
  );
  const newIds = newCandidates.slice(0, Math.min(newPerDay, remaining)).map((it) => it.id);
  remaining -= newIds.length;

  // 3) Fill any leftover budget with the nearest-due (not-yet-due) items.
  const used = new Set<string>([...dueIds, ...newIds]);
  const fillIds: string[] = [];
  if (remaining > 0) {
    const notDueSorted = [...cards].filter((c) => !used.has(c.itemId)).sort((a, b) => a.dueAt - b.dueAt);
    for (const c of notDueSorted.slice(0, remaining)) fillIds.push(c.itemId);
  }

  return {
    dateKey: dateKeyFor(nowMs, opts.tzOffsetMin ?? 0),
    itemIds: [...dueIds, ...newIds, ...fillIds],
    budgetSec,
    newCount: newIds.length,
    reviewCount: dueIds.length + fillIds.length,
  };
}
