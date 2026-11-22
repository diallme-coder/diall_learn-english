import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStreak } from './streak.ts';

const DAY_MS = 86_400_000;

test('counts consecutive local days back from today', () => {
  const now = Date.parse('2026-11-22T12:00:00Z'); // noon UTC
  const sessions = [
    Date.parse('2026-11-22T10:00:00Z'),
    Date.parse('2026-11-21T10:00:00Z'),
    Date.parse('2026-11-20T10:00:00Z'),
  ];
  assert.equal(computeStreak(sessions, now, 0), 3);
});

test('still counts the streak if today has no session yet, continuing from yesterday', () => {
  const now = Date.parse('2026-11-22T08:00:00Z');
  const sessions = [Date.parse('2026-11-21T20:00:00Z'), Date.parse('2026-11-20T20:00:00Z')];
  assert.equal(computeStreak(sessions, now, 0), 2);
});

test('a gap breaks the streak', () => {
  const now = Date.parse('2026-11-22T12:00:00Z');
  const sessions = [Date.parse('2026-11-22T10:00:00Z'), Date.parse('2026-11-19T10:00:00Z')];
  assert.equal(computeStreak(sessions, now, 0), 1);
});

test('no session at all gives a streak of 0', () => {
  assert.equal(computeStreak([], Date.parse('2026-11-22T12:00:00Z'), 0), 0);
});

// A session ending just after local midnight in Europe/Paris (UTC+1) is "today" (23rd) in
// Paris local time but still the 22nd in UTC. Each timezone must assign it to its own local
// day and still count a streak of 1 when "now" is read in that same timezone.
test('a session just after local midnight is assigned to the right local day (Europe/Paris vs UTC)', () => {
  const sessionEndUtc = Date.parse('2026-11-22T23:30:00Z'); // 00:30 the next day in Paris, 23:30 the same day in UTC
  const nowParisLocalMidnightPlus = Date.parse('2026-11-23T00:00:00Z'); // 01:00 in Paris, same local day as the session above

  const parisStreak = computeStreak([sessionEndUtc], nowParisLocalMidnightPlus, 60);
  assert.equal(parisStreak, 1); // session and "now" are both "2026-11-23" in Paris local time

  const utcStreak = computeStreak([sessionEndUtc], nowParisLocalMidnightPlus, 0);
  assert.equal(utcStreak, 1); // in UTC the session is "2026-11-22" (yesterday relative to "now"), still a live streak

  // The UTC-5 (e.g. New York) reading of the very same instants must agree with UTC here,
  // since neither instant crosses a UTC-5 local-day boundary relative to the UTC one.
  const nyStreak = computeStreak([sessionEndUtc], nowParisLocalMidnightPlus, -5 * 60);
  assert.equal(nyStreak, 1);
});
