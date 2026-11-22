// src/components/conversation/DebateFeedbackView.tsx: the post-call review (design 03 §5).
//
// Deviation from the design 03 §5 wireframe's "Highlights (3) | Rephrase (5) | Idioms (2)"
// tabs: `DebateFeedback` (types.ts) has no separate "highlights" field — only `items`
// (rephrases), `idiomsUsed`/`idiomsToTry` and `summaryFr`. `summaryFr` is shown as the intro
// instead of a "Highlights" tab, and a third tab is added for `codeSwitchCards` (the
// server-computed Franglais cards design 03 §5 says this screen must include). Flagged for a
// docs/design correction in the H3 handback report.
'use client';

import { useState } from 'react';
import type { DebateFeedback, RephraseFeedback } from '../../lib/types.ts';
import { t, type UiLangMode } from '../../lib/ui/strings.ts';
import SideCard from './SideCard.tsx';
import styles from './DebateFeedbackView.module.css';

type ReviewTab = 'rephrase' | 'idioms' | 'franglais';

export interface DebateFeedbackViewProps {
  feedback: DebateFeedback;
  chrome: UiLangMode;
  onHear(item: RephraseFeedback): void;
  onSayIt(item: RephraseFeedback): void;
  onHearCard(cardId: string): void;
}

const MAX_SHOWN = 5;

export default function DebateFeedbackView({ feedback, chrome, onHear, onSayIt, onHearCard }: DebateFeedbackViewProps) {
  const [tab, setTab] = useState<ReviewTab>('rephrase');
  const [showAll, setShowAll] = useState(false);
  const items = showAll ? feedback.items : feedback.items.slice(0, MAX_SHOWN);

  return (
    <div className="page">
      <h1>{t('reviewTitle', chrome)}</h1>
      <p lang="fr">{feedback.summaryFr}</p>
      <p lang="fr">{t('debateDeviceNotice', chrome)}</p>

      <div className={styles.tabs} role="tablist" aria-label={t('reviewTitle', chrome)}>
        <button type="button" className="chip" role="tab" aria-selected={tab === 'rephrase'} onClick={() => setTab('rephrase')}>
          {t('reviewTabRephrase', chrome)} ({feedback.items.length})
        </button>
        <button type="button" className="chip" role="tab" aria-selected={tab === 'idioms'} onClick={() => setTab('idioms')}>
          {t('reviewTabIdioms', chrome)} ({feedback.idiomsUsed.length})
        </button>
        <button type="button" className="chip" role="tab" aria-selected={tab === 'franglais'} onClick={() => setTab('franglais')}>
          {t('reviewTabFranglais', chrome)} ({feedback.codeSwitchCards.length})
        </button>
      </div>

      {tab === 'rephrase' ? (
        <section aria-label={t('reviewTabRephrase', chrome)}>
          {items.map((item, i) => (
            <article key={i} className={`transcript-bubble ${styles.item}`} data-speaker="user">
              <p lang="en">{item.original}</p>
              <p>{t('nativePhrasing', chrome)}</p>
              <p lang="en">{item.native}</p>
              <p lang="fr">
                {t('reviewWhy', chrome)}: {item.explanationFr}
              </p>
              <div className="side-card__actions">
                <button type="button" className="btn btn--ghost" onClick={() => onHear(item)}>
                  {t('sideCardHear', chrome)}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => onSayIt(item)}>
                  {t('reviewSayIt', chrome)}
                </button>
              </div>
            </article>
          ))}
          {!showAll && feedback.items.length > MAX_SHOWN ? (
            <button type="button" className="btn btn--secondary" onClick={() => setShowAll(true)}>
              {t('reviewSeeAll', chrome)}
            </button>
          ) : null}
        </section>
      ) : null}

      {tab === 'idioms' ? (
        <section aria-label={t('reviewTabIdioms', chrome)}>
          <h2>{t('reviewIdiomsUsed', chrome)}</h2>
          <ul>
            {feedback.idiomsUsed.map((idiom) => (
              <li key={idiom} lang="en">
                {idiom}
              </li>
            ))}
          </ul>
          <h2>{t('reviewTryNextTime', chrome)}</h2>
          <ul>
            {feedback.idiomsToTry.map((idiom) => (
              <li key={idiom} lang="en">
                {idiom}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === 'franglais' ? (
        <section aria-label={t('reviewTabFranglais', chrome)}>
          {feedback.codeSwitchCards.map((card) => (
            <SideCard key={card.id} card={card} collapsed={false} chrome={chrome} readOnly onHear={() => onHearCard(card.id)} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
