'use client';

// app/(app)/pronunciation/page.tsx: the trap library, list + detail (design 03 §6).
// `?trap=` deep-links through TRAP_DEEPLINK (h|th|vowels|stress -> a TrapCategory), per plan.
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAppShell } from '../../../src/components/core/providers.tsx';
import TrapCard from '../../../src/components/core/TrapCard.tsx';
import { TRAPS } from '../../../src/lib/pronunciation/traps.ts';
import PronunciationResult from '../../../src/components/core/PronunciationResult.tsx';
import MicButton from '../../../src/components/core/MicButton.tsx';
import { useVoiceAnswer } from '../../../src/components/core/useVoiceAnswer.ts';
import { getGuestAgeBand } from '../../../src/components/core/localFlags.ts';
import type { AgeBand, PronunciationReport, TrapCategory, TrapDeeplink } from '../../../src/lib/types.ts';
import { TRAP_DEEPLINK } from '../../../src/lib/types.ts';
import { t } from '../../../src/lib/ui/strings.ts';

export default function PronunciationPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { api, session } = useAppShell();
  const [ageBand, setAgeBand] = useState<AgeBand | null>(() => getGuestAgeBand());
  const [report, setReport] = useState<PronunciationReport | null>(null);
  const { start, stop, recording } = useVoiceAnswer('pronunciation');

  useEffect(() => {
    if (!session) return;
    void api.getProgress(-new Date().getTimezoneOffset()).then((result) => {
      if (result.ok) setAgeBand(result.value.profile.ageBand);
    });
  }, [api, session]);

  const trapParam = params.get('trap') as TrapDeeplink | null;
  const category: TrapCategory | null = trapParam && trapParam in TRAP_DEEPLINK ? TRAP_DEEPLINK[trapParam] : null;
  const selected = useMemo(() => TRAPS.find((trap) => trap.category === category) ?? null, [category]);

  async function handleTry(target: string) {
    setReport(null);
    const result = await start(target);
    const response = result.response;
    if (result.status === 'ok' && response?.status === 'ok' && response.report) {
      setReport(response.report);
    }
  }

  if (selected) {
    const practiceWord = selected.practiceWords[0] ?? selected.minimalPairs[0]?.target ?? '';
    return (
      <div>
        <button type="button" className="btn btn--ghost" onClick={() => router.push('/pronunciation')}>
          {t('back', 'fr')}
        </button>
        <TrapCard trap={selected} ageBand={ageBand} detail />
        {session ? (
          <MicButton state={recording ? 'listening' : 'idle'} onPress={() => (recording ? stop() : void handleTry(practiceWord))} />
        ) : (
          <p className="status-line">{t('pronunciationNeedsMic', 'fr')}</p>
        )}
        {report ? (
          <div>
            <p className="status-line">{t('pronunciationResultLabel', 'fr')}</p>
            <PronunciationResult report={report} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <h1>{t('pronunciationListTitle', 'fr')}</h1>
      <ul>
        {TRAPS.map((trap) => {
          const deeplink = Object.keys(TRAP_DEEPLINK).find((k) => TRAP_DEEPLINK[k as TrapDeeplink] === trap.category);
          return (
            <li key={trap.id}>
              <button type="button" className="btn btn--secondary" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => router.push(`/pronunciation?trap=${deeplink}`)}>
                <TrapCard trap={trap} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
