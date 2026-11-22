import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDailySet } from './dailySet.ts';
import { DRILL_ITEMS } from './catalog.ts';
import type { SrsCard } from '../types.ts';

const NOW = Date.parse('2026-11-22T10:00:00Z');
const DAY_MS = 86_400_000;

test('day 1 (no due cards, no cards at all) fills the whole 120s budget with new items', () => {
  const set = buildDailySet([], DRILL_ITEMS, NOW);
  assert.equal(set.budgetSec, 120);
  assert.equal(set.itemIds.length, 7); // floor(120 / 16)
  assert.equal(set.newCount, 7);
  assert.equal(set.reviewCount, 0);
});

test('15 overdue cards: fills with reviews, most overdue first, capped at capacity', () => {
  const cards: SrsCard[] = DRILL_ITEMS.slice(0, 15).map((item, i) => ({
    itemId: item.id,
    ease: 2.5,
    intervalDays: 1,
    repetitions: 1,
    lapses: 0,
    dueAt: NOW - (15 - i) * DAY_MS, // earlier index = more overdue
    lastReviewedAt: NOW - DAY_MS,
  }));
  const set = buildDailySet(cards, DRILL_ITEMS, NOW);
  assert.equal(set.itemIds.length, 7);
  assert.equal(set.reviewCount, 7);
  assert.equal(set.newCount, 0);
  // most overdue (smallest dueAt, i.e. first card) comes first
  assert.equal(set.itemIds[0], cards[0]!.itemId);
});

test('an existing (non-empty) deck caps new items at 3 per day by default', () => {
  const oneCard: SrsCard[] = [{ itemId: DRILL_ITEMS[0]!.id, ease: 2.5, intervalDays: 30, repetitions: 3, lapses: 0, dueAt: NOW + 10 * DAY_MS, lastReviewedAt: NOW }];
  const set = buildDailySet(oneCard, DRILL_ITEMS, NOW);
  assert.equal(set.newCount, 3);
});

test('dateKey reflects the given tz offset', () => {
  const lateUtc = Date.parse('2026-11-22T23:30:00Z');
  const paris = buildDailySet([], DRILL_ITEMS, lateUtc, { tzOffsetMin: 60 });
  assert.equal(paris.dateKey, '2026-11-23');
  const utc = buildDailySet([], DRILL_ITEMS, lateUtc, { tzOffsetMin: 0 });
  assert.equal(utc.dateKey, '2026-11-22');
});
