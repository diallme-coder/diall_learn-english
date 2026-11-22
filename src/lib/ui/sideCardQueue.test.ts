import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dismissSideCard,
  EMPTY_SIDE_CARD_QUEUE,
  enqueueSideCard,
  SIDE_CARD_COLLAPSE_MS,
  tickSideCardQueue,
} from './sideCardQueue.ts';
import type { SideCard } from '../types.ts';

function makeCard(id: string): SideCard {
  return {
    id,
    frenchSpan: 'embouteillage',
    englishSuggestion: 'traffic jam',
    note: '',
    span: { start: 0, end: 1 },
    confidence: 0.9,
  };
}

test('auto-collapses a visible card after SIDE_CARD_COLLAPSE_MS by default', () => {
  let state = enqueueSideCard(EMPTY_SIDE_CARD_QUEUE, makeCard('a'), 0);
  assert.strictEqual(state.visible.length, 1);

  state = tickSideCardQueue(state, SIDE_CARD_COLLAPSE_MS - 1, { sideCardAutoCollapse: true });
  assert.strictEqual(state.visible.length, 1, 'not yet collapsed');

  state = tickSideCardQueue(state, SIDE_CARD_COLLAPSE_MS, { sideCardAutoCollapse: true });
  assert.strictEqual(state.visible.length, 0);
  assert.strictEqual(state.collapsed.length, 1);
});

test('with sideCardAutoCollapse false, no collapse even after 60s', () => {
  let state = enqueueSideCard(EMPTY_SIDE_CARD_QUEUE, makeCard('a'), 0);
  state = tickSideCardQueue(state, 60_000, { sideCardAutoCollapse: false });
  assert.strictEqual(state.visible.length, 1);
  assert.strictEqual(state.collapsed.length, 0);
});

test('caps visible cards and queues overflow', () => {
  let state = EMPTY_SIDE_CARD_QUEUE;
  state = enqueueSideCard(state, makeCard('a'), 0);
  state = enqueueSideCard(state, makeCard('b'), 0);
  state = enqueueSideCard(state, makeCard('c'), 0);
  state = enqueueSideCard(state, makeCard('d'), 0);
  assert.strictEqual(state.visible.length, 3); // LIMITS.maxSideCardsPerUtterance
  assert.strictEqual(state.overflow.length, 1);
  assert.strictEqual(state.overflow[0]?.id, 'd');
});

test('collapsing frees room for a queued overflow card', () => {
  let state = EMPTY_SIDE_CARD_QUEUE;
  state = enqueueSideCard(state, makeCard('a'), 0);
  state = enqueueSideCard(state, makeCard('b'), 0);
  state = enqueueSideCard(state, makeCard('c'), 0);
  state = enqueueSideCard(state, makeCard('d'), 0);

  state = tickSideCardQueue(state, SIDE_CARD_COLLAPSE_MS, { sideCardAutoCollapse: true });
  assert.strictEqual(state.visible.length, 1);
  assert.strictEqual(state.visible[0]?.card.id, 'd');
  assert.strictEqual(state.overflow.length, 0);
  assert.strictEqual(state.collapsed.length, 3);
});

test('dismiss removes a card from wherever it is', () => {
  let state = enqueueSideCard(EMPTY_SIDE_CARD_QUEUE, makeCard('a'), 0);
  state = dismissSideCard(state, 'a');
  assert.strictEqual(state.visible.length, 0);
});
