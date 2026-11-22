// src/lib/ui/sideCardQueue.ts: pure queue manager for Franglais side-cards during a live turn
// (design 04 §5). Enqueue, auto-collapse after ~6s unless `sideCardAutoCollapse` is off (then it
// stays until dismissed), collapse-to-pill, and a cap on cards visible at once with overflow
// queued. No timers inside this module: the caller ticks it with the current time.
import type { ProfileSettings, SideCard } from '../types.ts';
import { LIMITS } from '../types.ts';

/** How long a visible card stays expanded before collapsing to a pill (design 04 §5). */
export const SIDE_CARD_COLLAPSE_MS = 6000;

export interface QueuedSideCard {
  card: SideCard;
  enqueuedAtMs: number;
}

export interface SideCardQueueState {
  visible: readonly QueuedSideCard[]; // at most LIMITS.maxSideCardsPerUtterance
  collapsed: readonly QueuedSideCard[]; // shown as a pill, still reachable
  overflow: readonly SideCard[]; // waiting for room in `visible`
}

export const EMPTY_SIDE_CARD_QUEUE: SideCardQueueState = { visible: [], collapsed: [], overflow: [] };

/** Adds a new card, visible immediately if there's room, else queued as overflow. */
export function enqueueSideCard(state: SideCardQueueState, card: SideCard, nowMs: number): SideCardQueueState {
  if (state.visible.length < LIMITS.maxSideCardsPerUtterance) {
    return { ...state, visible: [...state.visible, { card, enqueuedAtMs: nowMs }] };
  }
  return { ...state, overflow: [...state.overflow, card] };
}

/**
 * Advances the queue to `nowMs`: collapses visible cards older than `SIDE_CARD_COLLAPSE_MS`
 * (unless `settings.sideCardAutoCollapse` is false, in which case nothing ever auto-collapses),
 * then promotes overflow cards into any room freed up.
 */
export function tickSideCardQueue(
  state: SideCardQueueState,
  nowMs: number,
  settings: Pick<ProfileSettings, 'sideCardAutoCollapse'>,
): SideCardQueueState {
  if (settings.sideCardAutoCollapse === false) return state;

  const stillVisible: QueuedSideCard[] = [];
  const newlyCollapsed: QueuedSideCard[] = [];
  for (const entry of state.visible) {
    if (nowMs - entry.enqueuedAtMs >= SIDE_CARD_COLLAPSE_MS) newlyCollapsed.push(entry);
    else stillVisible.push(entry);
  }
  if (newlyCollapsed.length === 0) return state;

  let visible = stillVisible;
  let overflow = state.overflow;
  while (visible.length < LIMITS.maxSideCardsPerUtterance && overflow.length > 0) {
    const [next, ...rest] = overflow;
    if (next === undefined) break;
    visible = [...visible, { card: next, enqueuedAtMs: nowMs }];
    overflow = rest;
  }

  return { visible, collapsed: [...state.collapsed, ...newlyCollapsed], overflow };
}

/** Removes a card from wherever it currently is (visible, collapsed or overflow). */
export function dismissSideCard(state: SideCardQueueState, cardId: string): SideCardQueueState {
  return {
    visible: state.visible.filter((entry) => entry.card.id !== cardId),
    collapsed: state.collapsed.filter((entry) => entry.card.id !== cardId),
    overflow: state.overflow.filter((card) => card.id !== cardId),
  };
}
