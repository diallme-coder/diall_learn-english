'use client';

// app/(app)/progress/page.tsx: streak, weak phonemes, Franglais phrase bank, recent sessions
// (design 03 §8). Phoneme labels are relative buckets, shown only once minPhonemeAttempts is
// reached (plan H2); no invented scores.
import { useEffect, useState } from 'react';
import { useAppShell } from '../../../src/components/core/providers.tsx';
import { LIMITS, type ProgressSnapshot } from '../../../src/lib/types.ts';
import { t, type StringKey } from '../../../src/lib/ui/strings.ts';

function bucketKey(errorCount: number, attemptCount: number): StringKey {
  const rate = attemptCount === 0 ? 0 : errorCount / attemptCount;
  if (rate >= 0.4) return 'progressFragile';
  if (rate >= 0.15) return 'progressInProgress';
  return 'progressSolid';
}

export default function ProgressPage() {
  const { api, session, bucket } = useAppShell();
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);
  const [error, setError] = useState(false);
  const [range, setRange] = useState<7 | 30>(7);

  useEffect(() => {
    if (!session) return;
    const tzOffsetMin = -new Date().getTimezoneOffset();
    void api.getProgress(tzOffsetMin).then((result) => {
      if (result.ok) setSnapshot(result.value);
      else setError(true);
    });
  }, [api, session]);

  const dueCount = bucket.srsCards.filter((card) => card.dueAt <= Date.now()).length;

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>{t('navProgress', 'fr')}</h1>
        <div className="chip-row">
          <button type="button" className="chip" aria-pressed={range === 7} onClick={() => setRange(7)}>
            {t('progressRange7', 'fr')}
          </button>
          <button type="button" className="chip" aria-pressed={range === 30} onClick={() => setRange(30)}>
            {t('progressRange30', 'fr')}
          </button>
        </div>
      </header>

      {error ? <p className="banner" data-kind="error">{t('progressLoadError', 'fr')}</p> : null}

      {snapshot ? (
        <>
          <p>
            🔥 {t('progressStreakPrefix', 'fr')} {snapshot.streakDays}
          </p>

          <section>
            <h2>{t('progressPhonemesTitle', 'fr')}</h2>
            {snapshot.weakPhonemes.length === 0 ? (
              <p>{t('progressEmpty', 'fr')}</p>
            ) : (
              <ul>
                {snapshot.weakPhonemes.map((phoneme) => (
                  <li key={phoneme.trapId}>
                    {phoneme.trapId}{' '}
                    {phoneme.attemptCount >= LIMITS.minPhonemeAttempts
                      ? t(bucketKey(phoneme.errorCount, phoneme.attemptCount), 'fr')
                      : t('progressNotEnoughData', 'fr')}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>{t('progressPhraseBankTitle', 'fr')}</h2>
            <ul>
              {snapshot.vocabulary
                .filter((entry) => entry.source === 'franglais')
                .map((entry) => (
                  <li key={entry.term}>
                    {entry.frenchTerm} → {entry.term}
                  </li>
                ))}
            </ul>
          </section>

          <section>
            <h2>{t('progressRecentSessions', 'fr')}</h2>
            <ul>
              {snapshot.recentSessions.map((s) => (
                <li key={s.id}>
                  {s.kind} · {s.level}
                </li>
              ))}
            </ul>
          </section>

          <p>
            {dueCount} {t('progressSrsDue', 'fr')}
          </p>
        </>
      ) : (
        <p>{t('progressEmpty', 'fr')}</p>
      )}
    </div>
  );
}
