// src/components/conversation/SideCard.tsx: one Franglais safety-net card (design 04 §5).
// `role="status"` + the collapsed-pill state come straight from the `.side-card` design-token
// class in src/styles/globals.css; this component only supplies the content and actions.
//
// `readOnly` is used by DebateFeedbackView's post-call Franglais tab (design 03 §5: C1 shows
// these only after the call, not live) — there, Save/Dismiss/"not French" don't apply to a
// closed, saved review, so only Hear is offered; see the H3 handback report for this scope cut
// (a full re-open-into-the-live-queue affordance was not built).
'use client';

import type { SideCard as SideCardData } from '../../lib/types.ts';
import { t, type UiLangMode } from '../../lib/ui/strings.ts';
import styles from './SideCard.module.css';

export interface SideCardProps {
  card: SideCardData;
  collapsed: boolean;
  chrome: UiLangMode;
  onHear(): void;
  onRepeat?(): void;
  onSave?(): void;
  onDismiss?(): void;
  onNotFrench?(): void;
  readOnly?: boolean;
}

export default function SideCard({
  card,
  collapsed,
  chrome,
  onHear,
  onRepeat,
  onSave,
  onDismiss,
  onNotFrench,
  readOnly,
}: SideCardProps) {
  return (
    <div
      className="side-card"
      role="status"
      data-collapsed={collapsed}
      aria-label={collapsed ? t('sideCardCollapsedPill', chrome) : undefined}
    >
      <span className="side-card__label">{t('sideCardTitlePrefix', chrome)}</span>
      {collapsed ? null : (
        <div className={styles.body}>
          <p className="side-card__fr" lang="fr">
            {card.frenchSpan}
          </p>
          <p className="side-card__en" lang="en">
            {t('sideCardBodyPrefix', chrome)}: {card.englishSuggestion}
          </p>
          {card.note ? (
            <p lang="fr">{card.note}</p>
          ) : null}
          <div className="side-card__actions">
            <button type="button" className="btn btn--ghost" onClick={onHear}>
              {t('sideCardHear', chrome)}
            </button>
            {readOnly ? null : (
              <>
                {onRepeat ? (
                  <button type="button" className="btn btn--ghost" onClick={onRepeat}>
                    {t('sideCardRepeat', chrome)}
                  </button>
                ) : null}
                {onSave ? (
                  <button type="button" className="btn btn--ghost" onClick={onSave}>
                    {t('sideCardSave', chrome)}
                  </button>
                ) : null}
                {onNotFrench ? (
                  <button type="button" className="btn btn--ghost" onClick={onNotFrench}>
                    {t('sideCardNotFrench', chrome)}
                  </button>
                ) : null}
                {onDismiss ? (
                  <button type="button" className="btn btn--ghost" aria-label={t('sideCardDismiss', chrome)} onClick={onDismiss}>
                    {'✕'}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
