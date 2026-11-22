// src/components/conversation/SideCardStack.tsx: renders a src/lib/ui/sideCardQueue.ts state
// (design 04 §5: visible cards, collapsed pills, and an overflow count once the visible cap —
// LIMITS.maxSideCardsPerUtterance — is reached). The queue's ticking (collapse-after-6s) is
// driven by the page, not this component, so re-renders stay cheap.
'use client';

import SideCard from './SideCard.tsx';
import type { SideCardQueueState } from '../../lib/ui/sideCardQueue.ts';
import type { UiLangMode } from '../../lib/ui/strings.ts';

export interface SideCardStackProps {
  queue: SideCardQueueState;
  chrome: UiLangMode;
  onHear(cardId: string): void;
  onRepeat(cardId: string): void;
  onSave(cardId: string): void;
  onDismiss(cardId: string): void;
  onNotFrench(cardId: string): void;
}

export default function SideCardStack({ queue, chrome, onHear, onRepeat, onSave, onDismiss, onNotFrench }: SideCardStackProps) {
  if (queue.visible.length === 0 && queue.collapsed.length === 0) return null;

  return (
    <div aria-live="off">
      {queue.visible.map(({ card }) => (
        <SideCard
          key={card.id}
          card={card}
          collapsed={false}
          chrome={chrome}
          onHear={() => onHear(card.id)}
          onRepeat={() => onRepeat(card.id)}
          onSave={() => onSave(card.id)}
          onDismiss={() => onDismiss(card.id)}
          onNotFrench={() => onNotFrench(card.id)}
        />
      ))}
      {queue.collapsed.map(({ card }) => (
        <SideCard
          key={card.id}
          card={card}
          collapsed
          chrome={chrome}
          onHear={() => onHear(card.id)}
          onRepeat={() => onRepeat(card.id)}
          onSave={() => onSave(card.id)}
          onDismiss={() => onDismiss(card.id)}
          onNotFrench={() => onNotFrench(card.id)}
        />
      ))}
      {queue.overflow.length > 0 ? (
        <span className="side-card" data-collapsed="true">
          {`+${queue.overflow.length}`}
        </span>
      ) : null}
    </div>
  );
}
