// src/lib/security/rateLimit.ts
//
// In-memory token-bucket rate limiter, keyed by (scope, key, route).
//
// KNOWN LIMITATION (flag in README): this limiter holds its state in a
// plain Map in process memory. It is NOT shared across server instances —
// if the app is deployed behind multiple server processes or a serverless
// platform that runs more than one instance, each instance enforces its
// own independent limit, so the effective limit is `capacity * instances`.
// A production deployment that needs a hard global cap must move this to a
// shared store (e.g. Redis) behind the same `RateLimiter` interface.

import type { EpochMs, RateLimitDecision, RateLimiter } from '../types.ts';
import { IP_CAPACITY_MULTIPLIER, RATE_LIMITS } from '../types.ts';

interface Bucket {
  tokens: number;
  lastRefillMs: EpochMs;
  dayKey: string;
  usedToday: number;
}

function utcDayKey(nowMs: EpochMs): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function msUntilNextUtcDay(nowMs: EpochMs): number {
  const d = new Date(nowMs);
  const nextMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
  return Math.max(0, nextMidnight - nowMs);
}

export function createRateLimiter(): RateLimiter {
  const buckets = new Map<string, Bucket>();

  return {
    take(scope, key, route, nowMs): RateLimitDecision {
      const policy = RATE_LIMITS[route];
      const multiplier = scope === 'ip' ? IP_CAPACITY_MULTIPLIER : 1;
      const capacity = policy.capacity * multiplier;
      const refillPerMin = policy.refillPerMin * multiplier;

      const bucketKey = `${scope}:${route}:${key}`;
      let bucket = buckets.get(bucketKey);
      if (!bucket) {
        bucket = { tokens: capacity, lastRefillMs: nowMs, dayKey: utcDayKey(nowMs), usedToday: 0 };
        buckets.set(bucketKey, bucket);
      }

      const dayKey = utcDayKey(nowMs);
      if (bucket.dayKey !== dayKey) {
        bucket.dayKey = dayKey;
        bucket.usedToday = 0;
      }

      const elapsedMin = Math.max(0, nowMs - bucket.lastRefillMs) / 60000;
      bucket.tokens = Math.min(capacity, bucket.tokens + elapsedMin * refillPerMin);
      bucket.lastRefillMs = nowMs;

      // Daily budget applies only to the per-user scope on paid routes.
      if (scope === 'user' && policy.dailyBudget !== null && bucket.usedToday >= policy.dailyBudget) {
        return { allowed: false, remaining: 0, retryAfterSec: Math.ceil(msUntilNextUtcDay(nowMs) / 1000) };
      }

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        bucket.usedToday += 1;
        return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterSec: 0 };
      }

      const deficit = 1 - bucket.tokens;
      const retryAfterSec = refillPerMin > 0 ? Math.ceil((deficit / refillPerMin) * 60) : 60;
      return { allowed: false, remaining: 0, retryAfterSec };
    },
  };
}
