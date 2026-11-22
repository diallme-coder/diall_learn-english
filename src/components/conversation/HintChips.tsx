// src/components/conversation/HintChips.tsx: the 3 starter-phrase chips for roleplay (design 03
// §4, 04 §10 "Hint button"). Tapping the phrase chip itself plays the English model (04 §4 step
// 1 "chip tap plays the phrase, then the user repeats it" — chips never auto-fill speech, per
// design, so there is no "speak for me" affordance here); the separate (i) button opens the
// French explanation (`explanationFr`), which this component never renders itself — only the
// bottom sheet the caller opens does, keeping the choice of sheet/modal with the page.
'use client';

import type { Hint, HintTriple } from '../../lib/types.ts';
import { t, type UiLangMode } from '../../lib/ui/strings.ts';
import styles from './HintChips.module.css';

export interface HintChipsProps {
  hints: HintTriple;
  chrome: UiLangMode;
  onPlay(hint: Hint): void;
  onExplain(hint: Hint): void;
}

export default function HintChips({ hints, chrome, onPlay, onExplain }: HintChipsProps) {
  return (
    <div className="chip-row" role="group" aria-label={t('hintButton', chrome)}>
      {hints.map((hint) => (
        <span key={hint.id} className={styles.group}>
          <button type="button" className="chip" lang="en" onClick={() => onPlay(hint)}>
            {hint.en}
          </button>
          <button
            type="button"
            className={styles.explain}
            aria-label={`${t('hintExplanationLabel', chrome)}: ${hint.en}`}
            onClick={() => onExplain(hint)}
          >
            i
          </button>
        </span>
      ))}
    </div>
  );
}
