// src/components/core/PronunciationResult.tsx: renders a PronunciationReport — word-level
// highlights plus exactly one tip (design 03 §3 principle 4: one tip only), never a raw
// percentage by default (design 03 §3 principle 5).
import type { PronunciationReport } from '../../lib/types.ts';
import WordHighlight from './WordHighlight.tsx';
import type { UiLangMode } from '../../lib/ui/strings.ts';

export default function PronunciationResult({ report, mode = 'fr' }: { report: PronunciationReport; mode?: UiLangMode }) {
  return (
    <div>
      <WordHighlight referenceText={report.referenceText} words={report.words} mode={mode} />
      {report.primaryTip ? (
        <p className="banner" role="status">
          {report.primaryTip.tipFr}
        </p>
      ) : null}
    </div>
  );
}
