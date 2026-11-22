import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from './rateLimit.ts';
import { IP_CAPACITY_MULTIPLIER, RATE_LIMITS } from '../types.ts';

const START = Date.UTC(2026, 10, 22, 0, 0, 0);

test('rateLimit: a user can take up to capacity, then is denied', () => {
  const limiter = createRateLimiter();
  const capacity = RATE_LIMITS.chat.capacity;
  for (let i = 0; i < capacity; i++) {
    const decision = limiter.take('user', 'u1', 'chat', START);
    assert.equal(decision.allowed, true, `attempt ${i} should be allowed`);
  }
  const denied = limiter.take('user', 'u1', 'chat', START);
  assert.equal(denied.allowed, false);
  assert.ok(denied.retryAfterSec > 0);
});

test('rateLimit: tokens refill over time per refillPerMin', () => {
  const limiter = createRateLimiter();
  const capacity = RATE_LIMITS.tts.capacity;
  for (let i = 0; i < capacity; i++) limiter.take('user', 'u2', 'tts', START);
  const deniedNow = limiter.take('user', 'u2', 'tts', START);
  assert.equal(deniedNow.allowed, false);

  // After exactly one refill interval's worth of a minute, one token should
  // be back.
  const oneMinuteLater = START + 60_000;
  const decision = limiter.take('user', 'u2', 'tts', oneMinuteLater);
  assert.equal(decision.allowed, true);
});

test('rateLimit: refill math is linear in elapsed minutes', () => {
  const limiter = createRateLimiter();
  const capacity = RATE_LIMITS.transcribe.capacity; // 20
  const refillPerMin = RATE_LIMITS.transcribe.refillPerMin; // 20
  for (let i = 0; i < capacity; i++) limiter.take('user', 'u3', 'transcribe', START);
  // Half a minute later: half of refillPerMin tokens should have returned.
  const halfMinuteLater = START + 30_000;
  const expectedTokens = Math.floor((refillPerMin * 0.5));
  let allowedCount = 0;
  for (let i = 0; i < expectedTokens + 2; i++) {
    const decision = limiter.take('user', 'u3', 'transcribe', halfMinuteLater);
    if (decision.allowed) allowedCount++;
  }
  assert.equal(allowedCount, expectedTokens);
});

test('rateLimit: IP scope capacity is multiplied by IP_CAPACITY_MULTIPLIER', () => {
  const limiter = createRateLimiter();
  const capacity = RATE_LIMITS.chat.capacity * IP_CAPACITY_MULTIPLIER;
  let allowedCount = 0;
  for (let i = 0; i < capacity + 5; i++) {
    const decision = limiter.take('ip', '1.2.3.4', 'chat', START);
    if (decision.allowed) allowedCount++;
  }
  assert.equal(allowedCount, capacity);
});

test('rateLimit: dailyBudget applies to the user scope and resets the next UTC day', () => {
  const limiter = createRateLimiter();
  const budget = RATE_LIMITS.transcribe.dailyBudget;
  assert.ok(budget !== null);
  // Spend the daily budget across many refill cycles (one call every
  // minute, well within capacity+refill so only the daily cap binds).
  let t = START;
  let allowedCount = 0;
  for (let i = 0; i < (budget ?? 0) + 5; i++) {
    const decision = limiter.take('user', 'daily-user', 'transcribe', t);
    if (decision.allowed) allowedCount++;
    t += 60_000;
  }
  assert.equal(allowedCount, budget);

  // The next UTC day, the budget resets.
  const nextDay = Date.UTC(2026, 10, 23, 0, 0, 1);
  const decision = limiter.take('user', 'daily-user', 'transcribe', nextDay);
  assert.equal(decision.allowed, true);
});

test('rateLimit: different routes and keys do not share buckets', () => {
  const limiter = createRateLimiter();
  for (let i = 0; i < RATE_LIMITS.chat.capacity; i++) limiter.take('user', 'shared-key', 'chat', START);
  const deniedChat = limiter.take('user', 'shared-key', 'chat', START);
  assert.equal(deniedChat.allowed, false);
  const allowedTts = limiter.take('user', 'shared-key', 'tts', START);
  assert.equal(allowedTts.allowed, true);
});
