'use client';

// app/(session)/drills/page.tsx: the 2-minute daily micro-drill runner (design 03 §7).
// Works offline with cached drill set, self-check mode, no scoring (design 05 §1).
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAppShell } from '../../../src/components/core/providers.tsx';
import DrillRunner from '../../../src/components/core/DrillRunner.tsx';
import { useVoiceAnswer } from '../../../src/components/core/useVoiceAnswer.ts';
import { speak } from '../../../src/client/tts.ts';
import { DRILL_ITEMS } from '../../../src/lib/drills/catalog.ts';
import { buildDailySet } from '../../../src/lib/drills/dailySet.ts';
import { newCard, review } from '../../../src/lib/srs/scheduler.ts';
import type { DrillAttempt, DrillCheckResult, InputMode } from '../../../src/lib/types.ts';
import { t } from '../../../src/lib/ui/strings.ts';

export default function DrillsPage() {
  const router = useRouter();
  const { api, session, settings, bucket, dispatchLocal, enqueueEvent, userId } = useAppShell();
  const { start, stop, recording } = useVoiceAnswer('chat');
  const [online, setOnline] = useState(true);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const dailySet = useMemo(
    () => buildDailySet(bucket.srsCards, DRILL_ITEMS, Date.now(), { tzOffsetMin: -new Date().getTimezoneOffset() }),
    [bucket.srsCards],
  );
  const items = useMemo(
    () => dailySet.itemIds.map((id) => DRILL_ITEMS.find((it) => it.id === id)).filter((it): it is NonNullable<typeof it> => it !== undefined),
    [dailySet],
  );

  const guest = !session;
  const inputMode: InputMode = !online || guest ? 'self_check' : settings.textAnswerMode ? 'typed' : 'spoken';

  async function handleRecordRequested(): Promise<string | null> {
    const result = await start();
    const response = result.response;
    if (result.status === 'ok' && response?.status === 'ok') return response.transcript.text;
    return null;
  }

  function handleAttempt(attempt: DrillAttempt, _result: DrillCheckResult) {
    void _result;
    const existing = bucket.srsCards.find((c) => c.itemId === attempt.itemId) ?? newCard(attempt.itemId, attempt.answeredAt);
    const card = review(existing, attempt.grade, attempt.answeredAt);
    dispatchLocal({ type: 'srs_card_upserted', userId, card });
    if (session) {
      enqueueEvent({ type: 'drill_attempt', eventId: attempt.id, attempt, card });
    }
  }

  function handleSpeakNative(text: string) {
    void speak({ api, speechSynthesis: typeof window === 'undefined' ? undefined : window.speechSynthesis }, 'practice_word', text, text, settings.playbackRate);
  }

  if (items.length === 0) return <p className="status-line">{t('loading', 'fr')}</p>;

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" className="btn btn--ghost" onClick={() => router.push('/')}>
          ✕
        </button>
        <span className="status-line">{t('drillsCounterPrefix', 'fr')}</span>
      </header>

      {!online ? <p className="banner" role="status">{t('drillsOfflineNotice', 'fr')}</p> : null}
      {settings.textAnswerMode ? <p className="status-line">{t('drillsTextModeNotice', 'fr')}</p> : null}

      {finished ? (
        <div>
          <h2>{t('drillsEndTitle', 'fr')}</h2>
          <p>
            {items.length} / {items.length} · {Math.round(dailySet.budgetSec / 60)} min
          </p>
          <button type="button" className="btn" onClick={() => router.push('/')}>
            {t('drillsKeepPhrases', 'fr')}
          </button>
        </div>
      ) : (
        <DrillRunner
          items={items}
          inputMode={inputMode}
          onRecordRequested={inputMode === 'spoken' ? handleRecordRequested : undefined}
          onSpeakNative={handleSpeakNative}
          onAttempt={handleAttempt}
          onFinish={() => setFinished(true)}
        />
      )}

      {inputMode === 'spoken' && recording ? (
        <button type="button" className="btn btn--secondary" onClick={stop}>
          {t('interrupt', 'fr')}
        </button>
      ) : null}
    </div>
  );
}
