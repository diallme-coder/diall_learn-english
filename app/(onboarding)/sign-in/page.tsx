'use client';

// app/(onboarding)/sign-in/page.tsx: standalone sign-in (e.g. after Settings -> "Se
// déconnecter", or a deep link). Email OTP via src/client/auth.ts; no password anywhere.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAppShell } from '../../../src/components/core/providers.tsx';
import { t } from '../../../src/lib/ui/strings.ts';

export default function SignInPage() {
  const router = useRouter();
  const { auth, refreshSession } = useAppShell();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState(false);

  async function sendCode() {
    setError(false);
    const res = await auth.signInWithOtp(email);
    if (res.ok) setCodeSent(true);
    else setError(true);
  }

  async function verifyCode() {
    setError(false);
    const res = await auth.verifyOtp(email, code);
    if (!res.ok) {
      setError(true);
      return;
    }
    refreshSession();
    router.replace('/');
  }

  return (
    <section>
      <h1>{t('signInTitle', 'fr')}</h1>
      <p>{t('signInBody', 'fr')}</p>

      {!codeSent ? (
        <>
          <label htmlFor="sign-in-email">{t('signInEmailLabel', 'fr')}</label>
          <input id="sign-in-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="button" className="btn" onClick={() => void sendCode()}>
            {t('signInSendCode', 'fr')}
          </button>
        </>
      ) : (
        <>
          <p role="status">{t('signInCodeSentNotice', 'fr')}</p>
          <label htmlFor="sign-in-code">{t('signInCodeLabel', 'fr')}</label>
          <input id="sign-in-code" type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
          <button type="button" className="btn" onClick={() => void verifyCode()}>
            {t('signInVerify', 'fr')}
          </button>
        </>
      )}

      {error ? <p className="banner" data-kind="error">{t('signInError', 'fr')}</p> : null}
    </section>
  );
}
