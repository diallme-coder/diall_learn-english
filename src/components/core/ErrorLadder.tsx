'use client';

// src/components/core/ErrorLadder.tsx: renders the escalating recovery message from
// src/lib/ui/errorLadder.ts (design 04 §7). Rung 3 always offers the text-mode escape.
import { errorLadderMessage, rungForAttempt, type ErrorContext } from '../../lib/ui/errorLadder.ts';
import { t, type UiLangMode } from '../../lib/ui/strings.ts';

interface ErrorLadderProps {
  context: ErrorContext;
  attempt: number;
  mode?: UiLangMode;
  onRetry: () => void;
  onTextMode: () => void;
}

export default function ErrorLadder({ context, attempt, mode = 'fr', onRetry, onTextMode }: ErrorLadderProps) {
  const rung = rungForAttempt(context, attempt);
  const message = errorLadderMessage(context, attempt, mode);

  return (
    <div className="banner" data-kind="error" role="alert">
      <p>{message}</p>
      {rung.action === 'retry' ? (
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          {t('retry', mode)}
        </button>
      ) : null}
      {rung.action === 'text-mode' ? (
        <button type="button" className="btn btn--secondary" onClick={onTextMode}>
          {t('ladderTextMode', mode)}
        </button>
      ) : null}
    </div>
  );
}
