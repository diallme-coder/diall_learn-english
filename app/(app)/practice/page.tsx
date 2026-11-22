'use client';

// app/(app)/practice/page.tsx: mode chooser (design 02 §4). The level-recommended mode is
// shown first. Roleplay/Debate pickers are H3's; this page only links out to them.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAppShell } from '../../../src/components/core/providers.tsx';
import { getGuestLevel } from '../../../src/components/core/localFlags.ts';
import { defaultModeFor } from '../../../src/lib/levels/scaffolding.ts';
import type { CEFRLevel, PracticeMode } from '../../../src/lib/types.ts';
import { t, type UiLangMode } from '../../../src/lib/ui/strings.ts';

const MODE_ROUTE: Record<PracticeMode, string> = {
  shadowing: '/practice/shadowing',
  roleplay: '/practice/roleplay',
  debate: '/practice/debate',
};

const MODE_LABEL_KEY = {
  shadowing: 'modeShadowing',
  roleplay: 'modeRoleplay',
  debate: 'modeDebate',
} as const;

export default function PracticePage() {
  const { api, session } = useAppShell();
  const [level, setLevel] = useState<CEFRLevel>(() => getGuestLevel() ?? 'A1');

  useEffect(() => {
    if (!session) return;
    void api.getProgress(-new Date().getTimezoneOffset()).then((result) => {
      if (result.ok && result.value.profile.level) setLevel(result.value.profile.level);
    });
  }, [api, session]);

  const recommended = defaultModeFor(level);
  const mode: UiLangMode = 'fr';
  const order: PracticeMode[] = [recommended, ...(['shadowing', 'roleplay', 'debate'] as const).filter((m) => m !== recommended)];

  return (
    <div>
      <h1>{t('navPractice', mode)}</h1>
      <ul>
        {order.map((practiceMode) => (
          <li key={practiceMode}>
            <Link href={MODE_ROUTE[practiceMode]} className="btn btn--secondary">
              {t(MODE_LABEL_KEY[practiceMode], mode)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
