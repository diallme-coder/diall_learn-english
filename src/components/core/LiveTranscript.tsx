// src/components/core/LiveTranscript.tsx: shows the user what the system heard, so speech input
// always has a visible equivalent (design 05 §1 "User speech: live transcript shown"). Plain
// text: pronunciation highlighting is WordHighlight's job once a PronunciationReport exists.
import type { Transcript } from '../../lib/types.ts';
import type { UiLangMode } from '../../lib/ui/strings.ts';
import { t } from '../../lib/ui/strings.ts';

interface LiveTranscriptProps {
  transcript: Transcript | null;
  mode?: UiLangMode;
}

export default function LiveTranscript({ transcript, mode = 'fr' }: LiveTranscriptProps) {
  return (
    <div role="log" aria-live="off">
      <p className="status-line">{t('shadowingYourTry', mode)}</p>
      <p lang={transcript?.language === 'fr' ? 'fr' : 'en'}>{transcript?.text ?? ''}</p>
    </div>
  );
}
