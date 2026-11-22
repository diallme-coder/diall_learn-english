'use client';

// src/components/core/ConsentSheet.tsx: onboarding step 3 (plan H2). Honest processor
// disclosure per the review guardrail: audio/transcripts go to OpenAI and Anthropic/OpenAI;
// this NEVER claims the data is "never shared/stored". Accepting gates mic features
// (Profile.consent.version === PRIVACY_CONSENT_VERSION).
import Link from 'next/link';
import { t, type UiLangMode } from '../../lib/ui/strings.ts';

interface ConsentSheetProps {
  mode?: UiLangMode;
  onAccept: () => void;
  onDecline: () => void;
}

export default function ConsentSheet({ mode = 'fr', onAccept, onDecline }: ConsentSheetProps) {
  return (
    <section role="group" aria-labelledby="consent-title">
      <h2 id="consent-title">{t('consentTitle', mode)}</h2>
      <p>{t('consentBody', mode)}</p>
      <p>{t('privacyProcessorDisclosure', mode)}</p>
      <Link href="/privacy">{t('consentPrivacyLink', mode)}</Link>
      <div className="chip-row" style={{ marginTop: 'var(--space-4)' }}>
        <button type="button" className="btn" onClick={onAccept}>
          {t('consentAccept', mode)}
        </button>
        <button type="button" className="btn btn--secondary" onClick={onDecline}>
          {t('consentDecline', mode)}
        </button>
      </div>
    </section>
  );
}
