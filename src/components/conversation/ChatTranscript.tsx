// src/components/conversation/ChatTranscript.tsx: the AI/user bubble log (design 03 §4, 04 §9).
// A French span inside the user's own utterance is tagged with the `.word.fr` pattern from
// src/styles/globals.css (dotted underline + a text "FR" badge via CSS — never colour alone,
// design 04 §4 step 4), using `DetectedSpan` offsets straight into the ORIGINAL utterance string
// (types.ts's own comment on `DetectedSpan`), so no re-tokenising happens here.
//
// `aria-live="off"` on the log matches design 05 §3: captions stream without a live announce per
// word, with a single polite announce handled separately by StatusLine on state changes.
'use client';

import type { ReactNode } from 'react';
import type { DetectedSpan } from '../../lib/types.ts';

export interface TranscriptMessage {
  id: string;
  speaker: 'ai' | 'user';
  speakerLabel: string;
  text: string;
  translationFr?: string;
  streaming?: boolean;
  frenchSpans?: readonly DetectedSpan[];
}

export interface ChatTranscriptProps {
  messages: readonly TranscriptMessage[];
}

function renderAnnotated(text: string, spans: readonly DetectedSpan[] | undefined): ReactNode {
  if (!spans || spans.length === 0) return <span lang="en">{text}</span>;
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const nodes: ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((span, i) => {
    if (span.start > cursor) nodes.push(<span key={`plain-${i}`} lang="en">{text.slice(cursor, span.start)}</span>);
    nodes.push(
      <span key={`fr-${i}`} className="word fr" lang="fr">
        {text.slice(span.start, span.end)}
      </span>,
    );
    cursor = Math.max(cursor, span.end);
  });
  if (cursor < text.length) nodes.push(<span key="tail" lang="en">{text.slice(cursor)}</span>);
  return <>{nodes}</>;
}

export default function ChatTranscript({ messages }: ChatTranscriptProps) {
  return (
    <div role="log" aria-live="off">
      {messages.map((m) => (
        <div key={m.id} className="transcript-bubble" data-speaker={m.speaker} data-streaming={m.streaming ? 'true' : undefined}>
          {m.speakerLabel ? <span className="transcript-bubble__speaker">{m.speakerLabel}</span> : null}
          {m.speaker === 'user' ? renderAnnotated(m.text, m.frenchSpans) : <span lang="en">{m.text}</span>}
          {m.translationFr ? (
            <span className="transcript-bubble__translation" lang="fr">
              {m.translationFr}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
