'use client';

// src/components/core/AgeGate.tsx: onboarding step 2 (plan H2). 15+ required; under-15 is
// blocked with a clear, non-shaming message and the age is never stored (plan §3 "Must have").
// 15-17 sets ageBand '15-17', which disables the sensitive-reveal control elsewhere (TrapCard).
import { useState } from 'react';
import type { AgeBand } from '../../lib/types.ts';
import { t, type UiLangMode } from '../../lib/ui/strings.ts';

type Choice = AgeBand | 'under15';

interface AgeGateProps {
  mode?: UiLangMode;
  onContinue: (ageBand: AgeBand) => void;
}

export default function AgeGate({ mode = 'fr', onContinue }: AgeGateProps) {
  const [choice, setChoice] = useState<Choice | null>(null);

  return (
    <section role="group" aria-labelledby="age-gate-title">
      <h2 id="age-gate-title">{t('ageGateTitle', mode)}</h2>
      <fieldset>
        <legend className="sr-only">{t('ageGateTitle', mode)}</legend>
        {(['under15', '15-17', '18+'] as const).map((value) => (
          <label key={value} style={{ display: 'block', marginBlock: 'var(--space-2)' }}>
            <input
              type="radio"
              name="age-band"
              value={value}
              checked={choice === value}
              onChange={() => setChoice(value)}
            />{' '}
            {value === 'under15' ? t('ageGateUnder15Option', mode) : null}
            {value === '15-17' ? t('ageGateBand1517', mode) : null}
            {value === '18+' ? t('ageGateBand18', mode) : null}
          </label>
        ))}
      </fieldset>

      {choice === 'under15' ? (
        <p className="banner" data-kind="error" role="alert">
          {t('ageGateUnder15', mode)}
        </p>
      ) : (
        <button
          type="button"
          className="btn"
          disabled={choice === null}
          onClick={() => choice && onContinue(choice)}
        >
          {t('ageGateContinue', mode)}
        </button>
      )}
    </section>
  );
}
