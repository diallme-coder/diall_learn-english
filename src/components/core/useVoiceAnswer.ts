'use client';

// src/components/core/useVoiceAnswer.ts: the push-to-talk record -> transcribe flow shared by
// every H2 voice screen (shadowing, drills, pronunciation, placement). Wraps
// src/client/recorder.ts (MediaRecorder + the silence/too-short gate) and src/client/api.ts's
// transcribe() so screens don't each reimplement getUserMedia/AudioContext/MediaRecorder
// plumbing. Usage: `start()` on the first tap, `stop()` on the second (or let LIMITS.
// maxRecordingSec stop it); the promise `start()` returns resolves once transcribe() answers.
import { useCallback, useRef, useState } from 'react';
import { startRecording, type RecorderHandle, type RecordingResult } from '../../client/recorder.ts';
import { useAppShell } from './providers.tsx';
import type { TranscribePurpose, TranscribeResponse } from '../../lib/types.ts';

export interface VoiceAnswerResult {
  status: 'ok' | 'no_speech' | 'too_quiet' | 'denied' | 'error';
  response?: TranscribeResponse;
}

export function useVoiceAnswer(purpose: TranscribePurpose) {
  const { api } = useAppShell();
  const [recording, setRecording] = useState(false);
  const handleRef = useRef<RecorderHandle | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(
    (referenceText?: string): Promise<VoiceAnswerResult> => {
      setRecording(true);
      return new Promise((resolveOuter) => {
        void (async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const audioContext = new AudioContext();

            handleRef.current = startRecording(stream, audioContext, (recorded: RecordingResult) => {
              stream.getTracks().forEach((track) => track.stop());
              void audioContext.close();
              setRecording(false);
              void finish(recorded, referenceText).then(resolveOuter);
            });
          } catch {
            setRecording(false);
            resolveOuter({ status: 'denied' });
          }
        })();
      });

      async function finish(recorded: RecordingResult, referenceText?: string): Promise<VoiceAnswerResult> {
        if (!recorded.gate.accepted) {
          return { status: recorded.gate.reason === 'silent' ? 'too_quiet' : 'no_speech' };
        }
        const result = await api.transcribe(recorded.blob, purpose, referenceText);
        if (!result.ok) return { status: 'error' };
        const response = result.value as TranscribeResponse;
        return { status: response.status === 'no_speech' ? 'no_speech' : 'ok', response };
      }
    },
    [api, purpose],
  );

  const stop = useCallback(() => {
    handleRef.current?.stop();
  }, []);

  return { start, stop, recording };
}
