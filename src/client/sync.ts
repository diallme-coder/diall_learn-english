// src/client/sync.ts: drains the outbox (ui/outbox.ts) against the injected progress-posting
// function, applying outbox.ts's backoff schedule between retries.
import { backoffDelayMs, markFailed, markSent, type OutboxState } from '../lib/ui/outbox.ts';
import type { ApiClient } from './api.ts';

export interface SyncDeps {
  postProgress: ApiClient['postProgress'];
  setTimeout: (fn: () => void, ms: number) => unknown;
}

/**
 * Attempts to send every pending/failed item once. Returns the updated outbox state; items that
 * fail with a retryable error stay queued (with their attempt count bumped by `markFailed`), and
 * the caller may schedule the next drain after `backoffDelayMs(attempt)`.
 */
export async function drainOutbox(state: OutboxState, deps: SyncDeps): Promise<OutboxState> {
  let next = state;
  for (const item of state.items) {
    const result = await deps.postProgress(item.event);
    if (result.ok) {
      next = markSent(next, item.event.eventId);
      continue;
    }
    const retryable = result.error.code === 'rate_limited' || result.error.code.startsWith('upstream');
    next = markFailed(next, item.event.eventId, retryable);
  }
  return next;
}

/** Schedules a `drainOutbox` pass after the backoff delay for the given attempt count. */
export function scheduleNextDrain(
  deps: SyncDeps,
  attempt: number,
  run: () => void,
): void {
  deps.setTimeout(run, backoffDelayMs(attempt));
}
