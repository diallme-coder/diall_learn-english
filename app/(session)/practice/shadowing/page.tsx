'use client';

// app/(session)/practice/shadowing/page.tsx: sentence-set picker + session (design 03 §3).
// `?set=` optionally scopes to one level's set; otherwise defaults to A1.
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { useAppShell } from '../../../../src/components/core/providers.tsx';
import ShadowingPlayer from '../../../../src/components/core/ShadowingPlayer.tsx';
import WordHighlight from '../../../../src/components/core/WordHighlight.tsx';
import HighlightLegend from '../../../../src/components/core/HighlightLegend.tsx';
import MicButton from '../../../../src/components/core/MicButton.tsx';
import TextAnswerInput from '../../../../src/components/core/TextAnswerInput.tsx';
import ErrorLadder from '../../../../src/components/core/ErrorLadder.tsx';
import { useVoiceAnswer } from '../../../../src/components/core/useVoiceAnswer.ts';
import { shadowingFor } from '../../../../src/lib/levels/shadowing.ts';
import { TRAPS } from '../../../../src/lib/pronunciation/traps.ts';
import { TRAP_DEEPLINK, type CEFRLevel, type PronunciationReport, type TrapDeeplink } from '../../../../src/lib/types.ts';
import { t } from '../../../../src/lib/ui/strings.ts';

function deeplinkFor(trapId: string): TrapDeeplink | null {
  const trap = TRAPS.find((tr) => tr.id === trapId);
  if (!trap) return null;
  const entry = Object.entries(TRAP_DEEPLINK).find(([, category]) => category === trap.category);
  return (entry?.[0] as TrapDeeplink | undefined) ?? null;
}

function ShadowingSessionPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { settings, dispatchLocal, userId } = useAppShell();
  const level: CEFRLevel = (params.get('set') as CEFRLevel | null) ?? 'A1';
  const items = useMemo(() => shadowingFor(level), [level]);

  const [index, setIndex] = useState(0);
  const [report, setReport] = useState<PronunciationReport | null>(null);
  const [failCount, setFailCount] = useState(0);
  const { start, stop, recording } = useVoiceAnswer('shadowing');

  const item = items[index];

  async function handleRecord() {
    if (!item) return;
    setReport(null);
    const result = await start(item.textEn);
    const response = result.response;
    if (result.status === 'ok' && response?.status === 'ok' && response.report) {
      setReport(response.report);
      setFailCount(0);
    } else {
      setFailCount((c) => c + 1);
    }
  }

  function changeRate(rate: typeof settings.playbackRate) {
    dispatchLocal({ type: 'settings_updated', userId, settings: { playbackRate: rate } });
  }

  function next() {
    setReport(null);
    setFailCount(0);
    if (index + 1 >= items.length) router.push('/practice');
    else setIndex(index + 1);
  }

  if (!item) return <p className="status-line">{t('loading', 'fr')}</p>;

  const trapDeeplink = deeplinkFor(item.targetTraps[0] ?? '');

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" className="btn btn--ghost" onClick={() => router.push('/practice')}>
          ✕ {t('endSession', 'fr')}
        </button>
        <span className="status-line">
          {t('shadowingPhraseCounterPrefix', 'fr')} {index + 1} / {items.length}
        </span>
      </header>

      <ShadowingPlayer item={item} rate={settings.playbackRate} onRateChange={changeRate} captionsOn={settings.captionsOn} />

      <HighlightLegend />

      {failCount >= 3 && failCount > 0 ? (
        <ErrorLadder context="no_speech" attempt={failCount} onRetry={() => void handleRecord()} onTextMode={() => router.push(trapDeeplink ? `/pronunciation?trap=${trapDeeplink}` : '/pronunciation')} />
      ) : null}

      {report ? (
        <div>
          <p className="status-line">{t('shadowingIntelligibilityLabel', 'fr')}</p>
          <WordHighlight referenceText={report.referenceText} words={report.words} />
          {report.primaryTip ? <p className="banner" role="status">{report.primaryTip.tipFr}</p> : null}
        </div>
      ) : null}

      {settings.textAnswerMode ? (
        <TextAnswerInput labelKey="drillsTypeAnswer" submitKey="drillsSubmit" onSubmit={() => next()} />
      ) : (
        <MicButton state={recording ? 'listening' : 'idle'} onPress={() => (recording ? stop() : void handleRecord())} />
      )}

      <div className="chip-row">
        <button type="button" className="btn btn--secondary" onClick={() => void handleRecord()}>
          {t('retry', 'fr')}
        </button>
        <button type="button" className="btn" onClick={next}>
          {t('next', 'fr')}
        </button>
      </div>

      {trapDeeplink ? (
        <Link href={`/pronunciation?trap=${trapDeeplink}`}>{t('shadowingSeeTip', 'fr')}</Link>
      ) : null}
    </div>
  );
}

// useSearchParams() opts this page out of static rendering, which Next.js requires to be
// scoped behind a Suspense boundary (https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout).
export default function ShadowingSessionPage() {
  return (
    <Suspense fallback={null}>
      <ShadowingSessionPageInner />
    </Suspense>
  );
}
