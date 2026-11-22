// src/client/tts.ts: plays server TTS for the fixed catalog, falling back to the browser's
// speechSynthesis, and to text-only when no English voice exists at all. The decision of which
// strategy to use is extracted as a small pure function so it's testable without a real browser.
import type { TtsCatalog } from '../lib/types.ts';
import type { ApiClient } from './api.ts';

export type TtsStrategy = 'server' | 'speechSynthesis' | 'text-only';

/** Pure: which playback strategy to use, given what we know about the catalog hit and voices. */
export function pickTtsStrategy(input: { catalogHit: boolean; hasEnglishVoice: boolean }): TtsStrategy {
  if (input.catalogHit) return 'server';
  if (input.hasEnglishVoice) return 'speechSynthesis';
  return 'text-only';
}

/** True if any available `SpeechSynthesisVoice` is English. */
export function hasEnglishVoice(voices: readonly { lang: string }[]): boolean {
  return voices.some((v) => v.lang.toLowerCase().startsWith('en'));
}

export interface SpeakResult {
  strategy: TtsStrategy;
}

export interface TtsClientConfig {
  api: Pick<ApiClient, 'tts'>;
  speechSynthesis?: SpeechSynthesis;
}

/**
 * Speaks `text` for a fixed-catalog `id`, preferring the server, then the browser's
 * speechSynthesis, then reporting `text-only` so the caller can show text instead of audio.
 */
export async function speak(
  config: TtsClientConfig,
  catalog: TtsCatalog,
  id: string,
  text: string,
  playbackRate: number,
): Promise<SpeakResult> {
  const serverResult = await config.api.tts({ catalog, id });
  const strategy = pickTtsStrategy({
    catalogHit: serverResult.ok,
    hasEnglishVoice:
      config.speechSynthesis !== undefined && hasEnglishVoice(config.speechSynthesis.getVoices()),
  });

  if (strategy === 'server' && serverResult.ok) {
    const audio = new Audio(URL.createObjectURL(serverResult.value));
    audio.playbackRate = playbackRate;
    await audio.play();
    return { strategy };
  }

  if (strategy === 'speechSynthesis' && config.speechSynthesis !== undefined) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = playbackRate;
    config.speechSynthesis.speak(utterance);
    return { strategy };
  }

  return { strategy: 'text-only' };
}
