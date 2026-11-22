'use client';

// src/components/core/ShadowingPlayer.tsx: the model sentence, its French translation (always
// visible at A1-A2, design 02 §1), speed controls (0.6/0.85/1, PLAYBACK_RATES) and a
// karaoke-ish current-word highlight while the model audio plays. Playback goes through
// src/client/tts.ts's speak() (server catalog -> browser speechSynthesis -> text-only).
//
// Deviation: real word-level timings need `/api/tts?timings=1`, which src/client/api.ts's
// ApiClient does not yet expose a method for. Until that lands, the "current word" estimate
// below is proportional to each word's character length over the sentence's total estimated
// duration — a cosmetic approximation, not used for any scoring. Flagged in the handback.
import { useRef, useState } from 'react';
import { PLAYBACK_RATES, type PlaybackRate, type ShadowingItem } from '../../lib/types.ts';
import { speak } from '../../client/tts.ts';
import { useAppShell } from './providers.tsx';
import { t, type UiLangMode } from '../../lib/ui/strings.ts';
import styles from './ShadowingPlayer.module.css';

const WORDS_PER_SEC_AT_1X = 2.3;

function wordSpans(text: string): { word: string; start: number }[] {
  const spans: { word: string; start: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) spans.push({ word: m[0], start: m.index });
  return spans;
}

interface ShadowingPlayerProps {
  item: ShadowingItem;
  rate: PlaybackRate;
  onRateChange: (rate: PlaybackRate) => void;
  captionsOn: boolean;
  mode?: UiLangMode;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
}

export default function ShadowingPlayer({
  item,
  rate,
  onRateChange,
  captionsOn,
  mode = 'fr',
  onPlaybackStart,
  onPlaybackEnd,
}: ShadowingPlayerProps) {
  const { api } = useAppShell();
  const [translationVisible, setTranslationVisible] = useState(captionsOn);
  const [activeWordStart, setActiveWordStart] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const spans = wordSpans(item.textEn);

  function clearTimers() {
    for (const id of timers.current) clearTimeout(id);
    timers.current = [];
  }

  async function play() {
    clearTimers();
    onPlaybackStart?.();
    const estimatedDurationMs = (item.textEn.length / 5 / (WORDS_PER_SEC_AT_1X * rate)) * 1000;
    const perWordMs = spans.length > 0 ? estimatedDurationMs / spans.length : 0;
    spans.forEach((span, i) => {
      timers.current.push(setTimeout(() => setActiveWordStart(span.start), i * perWordMs));
    });
    timers.current.push(
      setTimeout(() => {
        setActiveWordStart(null);
        onPlaybackEnd?.();
      }, estimatedDurationMs),
    );

    await speak(
      { api, speechSynthesis: typeof window === 'undefined' ? undefined : window.speechSynthesis },
      'shadowing',
      item.id,
      item.textEn,
      rate,
    );
  }

  return (
    <div>
      <p className={styles.sentence} lang="en">
        {spans.map((span, i) => {
          const end = i + 1 < spans.length ? spans[i + 1]!.start : item.textEn.length;
          const isActive = activeWordStart === span.start;
          return (
            <span key={span.start} aria-current={isActive ? 'true' : undefined} className={isActive ? 'word' : undefined}>
              {item.textEn.slice(span.start, end)}
            </span>
          );
        })}
      </p>
      {translationVisible ? <p className={styles.translation} lang="fr">{item.translationFr}</p> : null}
      <div className={styles.controls}>
        <button type="button" className="btn" onClick={() => void play()}>
          {t('shadowingListen', mode)}
        </button>
        {PLAYBACK_RATES.map((r) => (
          <button
            key={r}
            type="button"
            className="chip"
            aria-pressed={rate === r}
            onClick={() => onRateChange(r)}
          >
            {r === 1 ? t('settingsSpeed1', mode) : r === 0.85 ? t('settingsSpeed085', mode) : t('settingsSpeed06', mode)}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={translationVisible} onClick={() => setTranslationVisible((v) => !v)}>
          {t('settingsCaptions', mode)}
        </button>
      </div>
    </div>
  );
}
