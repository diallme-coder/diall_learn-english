// src/components/conversation/useAiSpeech.ts: plays the AI's spoken turn in roleplay/debate.
//
// src/client/tts.ts's `speak()` already picks the right strategy (server catalog, then
// speechSynthesis, then text-only) via its exported `pickTtsStrategy`/`hasEnglishVoice`, but it
// plays the audio itself and resolves as soon as playback *starts*, with no completion signal —
// there is no way for a caller to know when the AI has finished talking, which the "speaking"
// session state needs (to move back to idle) and barge-in needs (to cancel mid-playback). Rather
// than changing tts.ts (owned by H1, already landed and verified), this hook reuses its two pure
// decision functions and owns the Audio/SpeechSynthesisUtterance itself so it can hook `onended`.
// See the H3 handback report for this gap.
//
// The catalog/id pair tts.ts expects is for the *fixed* catalog (shadowing sentences, hint
// phrases, practice words) — docs/PLAN.md §1 is explicit that TTS is "a fixed, cached catalog",
// and a live chat reply is never in it. So the server lookup below always misses for a dynamic
// reply, and playback falls through to speechSynthesis (or text-only without a voice) by design;
// `catalog: 'hint'` is used only as the closest-fit bucket, with a synthetic id that can never
// collide with a real hint id.
'use client';

import { useCallback, useRef } from 'react';
import type { ApiClient } from '../../client/api.ts';
import { hasEnglishVoice, pickTtsStrategy } from '../../client/tts.ts';

export interface AiSpeechHandle {
  /** Starts speaking `text`; calls `onDone` exactly once, however playback ends. */
  speak(text: string, playbackRate: number, onDone: () => void): void;
  /** Stops any in-progress playback (barge-in). Does NOT call the pending onDone. */
  interrupt(): void;
}

export function useAiSpeech(api: ApiClient): AiSpeechHandle {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const interrupt = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speak = useCallback(
    (text: string, playbackRate: number, onDone: () => void) => {
      const synthesis = typeof window === 'undefined' ? undefined : window.speechSynthesis;
      const syntheticId = `live-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        onDone();
      };

      void api.tts({ catalog: 'hint', id: syntheticId }).then((result) => {
        const strategy = pickTtsStrategy({
          catalogHit: result.ok,
          hasEnglishVoice: synthesis !== undefined && hasEnglishVoice(synthesis.getVoices()),
        });

        if (strategy === 'server' && result.ok) {
          const audio = new Audio(URL.createObjectURL(result.value));
          audio.playbackRate = playbackRate;
          audio.onended = finish;
          audio.onerror = finish;
          audioRef.current = audio;
          void audio.play().catch(finish);
          return;
        }

        if (strategy === 'speechSynthesis' && synthesis !== undefined) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'en-US';
          utterance.rate = playbackRate;
          utterance.onend = finish;
          utterance.onerror = finish;
          synthesis.speak(utterance);
          return;
        }

        // text-only: the caption/transcript bubble already carries the text on screen.
        finish();
      });
    },
    [api],
  );

  return { speak, interrupt };
}
