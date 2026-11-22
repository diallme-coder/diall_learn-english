// src/components/core/WordHighlight.tsx: renders a PronunciationReport's WordScore[] as inline
// spans, driven ONLY by charStart/charEnd into referenceText (plan H2 constraint) — never by
// re-splitting the text some other way. Colour is never the only signal: pattern + glyph + an
// aria-label always carry the same meaning (design 05 §4; src/lib/ui/highlight.ts).
import type { WordScore } from '../../lib/types.ts';
import { highlightAriaLabel, highlightForStatus } from '../../lib/ui/highlight.ts';
import type { UiLangMode } from '../../lib/ui/strings.ts';

const STATUS_CLASS: Record<WordScore['status'], string> = {
  ok: 'ok',
  warn: 'warn',
  error: 'err',
  unsure: 'unsure',
};

interface WordHighlightProps {
  referenceText: string;
  words: readonly WordScore[];
  mode?: UiLangMode;
  activeIndex?: number | null;
}

export default function WordHighlight({ referenceText, words, mode = 'fr', activeIndex = null }: WordHighlightProps) {
  return (
    <p lang="en" style={{ fontSize: 'var(--text-practice)', lineHeight: 'var(--leading-loose)' }}>
      {words.map((w) => {
        const text = referenceText.slice(w.charStart, w.charEnd);
        const descriptor = highlightForStatus(w.status, mode);
        return (
          <span key={w.index}>
            <span
              className={`word ${STATUS_CLASS[w.status]}`}
              aria-label={highlightAriaLabel(text, w.status, mode)}
              aria-current={activeIndex === w.index ? 'true' : undefined}
              data-pattern={descriptor.pattern}
            >
              {text}
            </span>
            {' '}
          </span>
        );
      })}
    </p>
  );
}
