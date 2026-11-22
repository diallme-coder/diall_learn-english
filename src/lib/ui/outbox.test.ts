import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addToOutbox, backoffDelayMs, EMPTY_OUTBOX, markFailed, markSent } from './outbox.ts';
import type { ClientProgressEvent } from '../types.ts';

function levelEvent(eventId: string): ClientProgressEvent {
  return { eventId, type: 'level_set', level: 'A2' };
}

test('addToOutbox dedupes by eventId', () => {
  let state = addToOutbox(EMPTY_OUTBOX, levelEvent('e1'));
  state = addToOutbox(state, levelEvent('e1'));
  assert.strictEqual(state.items.length, 1);
});

test('markSent removes the item', () => {
  let state = addToOutbox(EMPTY_OUTBOX, levelEvent('e1'));
  state = markSent(state, 'e1');
  assert.strictEqual(state.items.length, 0);
});

test('markFailed keeps retryable items pending and bumps attempt', () => {
  let state = addToOutbox(EMPTY_OUTBOX, levelEvent('e1'));
  state = markFailed(state, 'e1', true);
  assert.strictEqual(state.items.length, 1);
  assert.strictEqual(state.items[0]?.attempt, 1);
  assert.strictEqual(state.items[0]?.status, 'failed');
});

test('markFailed drops non-retryable items (e.g. a 4xx other than 429)', () => {
  let state = addToOutbox(EMPTY_OUTBOX, levelEvent('e1'));
  state = markFailed(state, 'e1', false);
  assert.strictEqual(state.items.length, 0);
});

test('backoffDelayMs is monotonically increasing and capped', () => {
  const delays = [1, 2, 3, 4, 5, 10, 20].map(backoffDelayMs);
  for (let i = 1; i < delays.length; i++) {
    assert.ok((delays[i] ?? 0) >= (delays[i - 1] ?? 0), `delay should not decrease: ${delays[i - 1]} -> ${delays[i]}`);
  }
  assert.ok(delays[delays.length - 1]! <= 60_000);
});
