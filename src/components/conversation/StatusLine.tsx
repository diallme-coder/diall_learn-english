// src/components/conversation/StatusLine.tsx: the shared `role="status"` aria-live region
// (design 03 §0, 05 §3). `announce=false` turns it off rather than merely visual, which is how
// `silenceAnnouncementsWhileRecording` (design 05 §3's "known conflict between voice input and
// screen readers") is honoured while the mic is listening.
'use client';

export interface StatusLineProps {
  text: string;
  announce: boolean;
}

export default function StatusLine({ text, announce }: StatusLineProps) {
  return (
    <p className="status-line" role="status" aria-live={announce ? 'polite' : 'off'}>
      {text}
    </p>
  );
}
