// src/components/core/HighlightLegend.tsx: the one-line legend shown on first use of word
// highlighting (design 03 §3: "Souligné ondulé = presque ; souligné double = à travailler").
import { t, type UiLangMode } from '../../lib/ui/strings.ts';

export default function HighlightLegend({ mode = 'fr' }: { mode?: UiLangMode }) {
  return (
    <p className="status-line">
      <span className="word ok">{t('highlightOk', mode)}</span>{' '}
      <span className="word warn">{t('highlightWarn', mode)}</span>{' '}
      <span className="word err">{t('highlightError', mode)}</span>{' '}
      <span className="word unsure">{t('highlightUnsure', mode)}</span>
      {' — '}
      {t('shadowingLegend', mode)}
    </p>
  );
}
