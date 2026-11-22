// src/lib/drills/index.ts: the public surface for Unit D's drills module (see docs/PLAN.md §7.0).
export { DRILL_ITEMS, getDrill } from './catalog.ts';
export { normalizeAnswer } from './normalize.ts';
export { checkAnswer } from './checker.ts';
export { buildDailySet, type BuildDailySetOptions } from './dailySet.ts';
