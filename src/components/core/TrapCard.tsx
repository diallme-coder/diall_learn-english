'use client';

// src/components/core/TrapCard.tsx: one pronunciation trap, list row or detail view
// (design 03 §6). The sensitive minimal pair (beach/bitch) is handled EXACTLY through
// src/lib/pronunciation/sensitive.ts's API — tapToRevealNote / revealConfusedWith — never
// bypassed: the rude word is never rendered or spoken unless the user makes the explicit
// "Entendre la différence" tap, and that control is disabled outright for ageBand '15-17'.
import { useState } from 'react';
import type { AgeBand, MinimalPair, PronunciationTrap } from '../../lib/types.ts';
import { tapToRevealNote, revealConfusedWith } from '../../lib/pronunciation/sensitive.ts';
import MouthDiagram from './MouthDiagram.tsx';
import { MOUTH_DIAGRAMS } from '../../lib/pronunciation/diagrams.ts';
import { t, type UiLangMode } from '../../lib/ui/strings.ts';

function MinimalPairRow({ pair, ageBand, mode }: { pair: MinimalPair; ageBand: AgeBand | null; mode: UiLangMode }) {
  const [revealed, setRevealed] = useState(false);
  const note = tapToRevealNote(pair);
  const canReveal = note !== null && ageBand !== '15-17';
  const confused = revealConfusedWith(pair, revealed);

  return (
    <li>
      <span className="ipa" lang="en-fonipa">{pair.targetIpa}</span> {pair.target}
      {' ≠ '}
      {confused !== null ? (
        <>
          <span className="ipa" lang="en-fonipa">{pair.confusedIpa}</span> {confused}
        </>
      ) : (
        <em>{note?.noteFr}</em>
      )}
      {note !== null && canReveal && !revealed ? (
        <button type="button" className="btn btn--ghost" onClick={() => setRevealed(true)}>
          {t('pronunciationRevealCta', mode)}
        </button>
      ) : null}
    </li>
  );
}

interface TrapCardProps {
  trap: PronunciationTrap;
  mode?: UiLangMode;
  ageBand?: AgeBand | null;
  detail?: boolean;
  onTry?: () => void;
}

export default function TrapCard({ trap, mode = 'fr', ageBand = null, detail = false, onTry }: TrapCardProps) {
  if (!detail) {
    return (
      <>
        <span className="ipa" lang="en-fonipa">{trap.ipa}</span> {trap.titleFr}
      </>
    );
  }

  return (
    <article aria-labelledby={`trap-${trap.id}-title`}>
      <h2 id={`trap-${trap.id}-title`}>
        {trap.titleFr} <span className="ipa" lang="en-fonipa">{trap.ipa}</span>
      </h2>
      <MouthDiagram diagram={MOUTH_DIAGRAMS[trap.category]} mode={mode} />
      <p>{trap.mouthTipFr}</p>
      <ul>
        {trap.minimalPairs.map((pair) => (
          <MinimalPairRow key={pair.target} pair={pair} ageBand={ageBand} mode={mode} />
        ))}
      </ul>
      {onTry ? (
        <button type="button" className="btn" onClick={onTry}>
          {t('pronunciationTryCta', mode)}
        </button>
      ) : null}
    </article>
  );
}
