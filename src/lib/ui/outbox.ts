// src/lib/ui/outbox.ts: pure reducer for an offline-tolerant outbox of progress events awaiting
// sync (design: plan §7 unit H1). Events are keyed by `eventId` (already set by the caller).
// `sync.ts` (src/client) drains this against the server, applying the backoff schedule below.
import type { ClientProgressEvent } from '../types.ts';

export type OutboxItemStatus = 'pending' | 'failed';

export interface OutboxItem {
  event: ClientProgressEvent;
  status: OutboxItemStatus;
  attempt: number; // number of failed attempts so far
}

export interface OutboxState {
  items: readonly OutboxItem[];
}

export const EMPTY_OUTBOX: OutboxState = { items: [] };

/** Adds `event` to the outbox, deduped by `eventId` (a duplicate add is a no-op). */
export function addToOutbox(state: OutboxState, event: ClientProgressEvent): OutboxState {
  if (state.items.some((item) => item.event.eventId === event.eventId)) return state;
  return { items: [...state.items, { event, status: 'pending', attempt: 0 }] };
}

/** Removes an event once the server has confirmed it was recorded. */
export function markSent(state: OutboxState, eventId: string): OutboxState {
  return { items: state.items.filter((item) => item.event.eventId !== eventId) };
}

/**
 * Marks a send attempt as failed. `retryable` events go back to `pending` with their attempt
 * count bumped (so backoff grows); non-retryable events (e.g. a 4xx other than 429) are dropped.
 */
export function markFailed(state: OutboxState, eventId: string, retryable: boolean): OutboxState {
  if (!retryable) return { items: state.items.filter((item) => item.event.eventId !== eventId) };
  return {
    items: state.items.map((item) =>
      item.event.eventId === eventId ? { ...item, status: 'failed', attempt: item.attempt + 1 } : item,
    ),
  };
}

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 60_000;

/** Exponential backoff delay before retrying the Nth failed attempt (1-based), capped. */
export function backoffDelayMs(attempt: number): number {
  const n = Math.max(attempt, 1);
  return Math.min(BACKOFF_BASE_MS * 2 ** (n - 1), BACKOFF_MAX_MS);
}
