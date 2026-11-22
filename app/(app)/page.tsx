'use client';

// app/(app)/page.tsx: Home (design 03 §1). One obvious next action, today's streak, the day's
// drill. Redirects to /onboarding when there is no local sign of a finished first run.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAppShell } from '../../src/components/core/providers.tsx';
import LevelBadge from '../../src/components/core/LevelBadge.tsx';
import { scaffoldingFor } from '../../src/lib/levels/scaffolding.ts';
import type { ProgressSnapshot } from '../../src/lib/types.ts';
import { isOnboarded } from '../../src/components/core/localFlags.ts';
import { t } from '../../src/lib/ui/strings.ts';

export default function HomePage() {
  const router = useRouter();
  const { api, session } = useAppShell();
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isOnboarded()) router.replace('/onboarding');
  }, [router]);

  useEffect(() => {
    if (!session) {
      setLoaded(true);
      return;
    }
    const tzOffsetMin = -new Date().getTimezoneOffset();
    void api.getProgress(tzOffsetMin).then((result) => {
      if (result.ok) setSnapshot(result.value);
      setLoaded(true);
    });
  }, [api, session]);

  const level = snapshot?.profile.level ?? null;
  const mode = level ? scaffoldingFor(level).chrome : 'fr';
  const weakest = snapshot?.weakPhonemes
    .slice()
    .sort((a, b) => b.errorCount / Math.max(1, b.attemptCount) - a.errorCount / Math.max(1, a.attemptCount))[0];

  if (!loaded) return <p className="status-line">{t('loading', mode)}</p>;

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>
          {t('homeGreeting', mode)}
          {level ? <> · <LevelBadge level={level} mode={mode} /></> : null}
        </h1>
        <Link href="/settings" aria-label={t('navSettings', mode)}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </svg>
        </Link>
      </header>

      {snapshot ? (
        <p>
          🔥 {snapshot.streakDays} {t('homeStreakSuffix', mode)}
        </p>
      ) : null}

      <section className="side-card" aria-label={t('homeContinueLabel', mode)}>
        <p className="side-card__label">{t('homeContinueLabel', mode)}</p>
        <Link href="/practice" className="btn">
          {t('homeResume', mode)}
        </Link>
      </section>

      <section className="side-card">
        <p className="side-card__label">{t('homeDrillCardTitle', mode)}</p>
        <Link href="/drills" className="btn">
          {t('homeDrillStart', mode)}
        </Link>
      </section>

      {weakest && weakest.attemptCount > 0 ? (
        <p>
          {t('homeWeakPhonemePrefix', mode)} {weakest.trapId}{' '}
          <Link href={`/pronunciation?trap=${weakest.trapId}`}>{t('homeWorkOn', mode)}</Link>
        </p>
      ) : null}

      {!snapshot ? <p>{t('homeEmptyTitle', mode)}</p> : null}
    </div>
  );
}
