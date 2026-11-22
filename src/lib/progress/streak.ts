// src/lib/progress/streak.ts: computeStreak counts consecutive local days with >= 1 session,
// counted back from today (or yesterday, if today has no session yet).
import type { EpochMs } from '../types.ts';

const DAY_MS = 86_400_000;

function localDateKey(ms: EpochMs, tzOffsetMin: number): string {
  const d = new Date(ms + tzOffsetMin * 60_000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function computeStreak(sessionEndTimes: readonly EpochMs[], nowMs: EpochMs, tzOffsetMin: number): number {
  const daysWithSession = new Set(sessionEndTimes.map((t) => localDateKey(t, tzOffsetMin)));

  let cursorMs = nowMs;
  if (!daysWithSession.has(localDateKey(cursorMs, tzOffsetMin))) {
    cursorMs -= DAY_MS; // today has no session yet; a streak can still continue from yesterday
  }

  let streak = 0;
  while (daysWithSession.has(localDateKey(cursorMs, tzOffsetMin))) {
    streak += 1;
    cursorMs -= DAY_MS;
  }
  return streak;
}
