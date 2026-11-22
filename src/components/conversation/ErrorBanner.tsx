// src/components/conversation/ErrorBanner.tsx: renders one rung of src/lib/ui/errorLadder.ts
// (design 04 §7). The banner's own message is a blocking failure, so it is the one place in
// these screens that uses `role="alert"` (design 05 §6: "announced via role=alert only for
// blocking failures" — StatusLine's role="status" is for routine state changes only).
'use client';

import type { LadderRung } from '../../lib/ui/errorLadder.ts';
import { t, type UiLangMode } from '../../lib/ui/strings.ts';

export interface ErrorBannerProps {
  rung: LadderRung;
  chrome: UiLangMode;
  onRetry(): void;
  onTextMode(): void;
}

export default function ErrorBanner({ rung, chrome, onRetry, onTextMode }: ErrorBannerProps) {
  return (
    <div className="banner" data-kind="error" role="alert">
      <p>{t(rung.messageKey, chrome)}</p>
      {rung.action === 'retry' ? (
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          {t('retry', chrome)}
        </button>
      ) : null}
      {rung.action === 'text-mode' ? (
        <button type="button" className="btn btn--secondary" onClick={onTextMode}>
          {t('ladderTextMode', chrome)}
        </button>
      ) : null}
    </div>
  );
}
