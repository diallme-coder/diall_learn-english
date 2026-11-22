'use client';

// app/(onboarding)/onboarding/page.tsx: welcome -> age gate -> consent -> mic permission ->
// goal -> placement quiz -> sign-in (plan H2, docs/PLAN.md §13 "placement can run signed-out;
// saving results needs sign-in -- design this flow sensibly and document your choice").
//
// Design choice (documented here since docs/design/** is frozen and plan §13 asked for it):
// placement itself never requires an account — PLACEMENT_QUESTIONS' 'speak' items are skipped
// entirely when mic permission was never granted (PlacementQuiz's `speakAllowed`), and
// `selfSelectPlacement` is always one tap away. Sign-in is offered ONCE, right after the result
// screen, framed as "keep this result" rather than as a gate: accepting saves `level_set` (and
// the consent already accepted) to the server via H1's outbox; "Continuer sans compte" stores
// the same result locally only (components/core/localFlags.ts) and the learner can still use
// drills (typed/self-check), the trap library and shadowing's browser-TTS playback as a guest,
// per plan §13's guest-scope note. The result is never lost either way; it's just not synced.
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAppShell } from '../../../src/components/core/providers.tsx';
import { markOnboarded, setGuestAgeBand, setGuestLevel } from '../../../src/components/core/localFlags.ts';
import AgeGate from '../../../src/components/core/AgeGate.tsx';
import ConsentSheet from '../../../src/components/core/ConsentSheet.tsx';
import PlacementQuiz from '../../../src/components/core/PlacementQuiz.tsx';
import LevelBadge from '../../../src/components/core/LevelBadge.tsx';
import MicPermissionGate from '../../../src/components/pwa/MicPermissionGate.tsx';
import { useVoiceAnswer } from '../../../src/components/core/useVoiceAnswer.ts';
import { PLACEMENT_QUESTIONS } from '../../../src/lib/levels/placementQuestions.ts';
import { defaultModeFor } from '../../../src/lib/levels/scaffolding.ts';
import { PRIVACY_CONSENT_VERSION } from '../../../src/lib/types.ts';
import type { AgeBand, PlacementQuestion, PlacementResult } from '../../../src/lib/types.ts';
import { t, type StringKey } from '../../../src/lib/ui/strings.ts';

type Step = 'welcome' | 'age' | 'consent' | 'mic' | 'goal' | 'placement' | 'signin' | 'done';

/** MicPermissionGate only renders its children once permission is 'granted'; this mounts a
 * one-shot effect right there to flip the onboarding flow's own `micGranted` flag. */
function MicGrantedNotifier({ onGranted }: { onGranted: () => void }) {
  useEffect(() => {
    onGranted();
  }, [onGranted]);
  return null;
}

const GOAL_OPTIONS: readonly StringKey[] = ['goalWork', 'goalTravel', 'goalExam', 'goalFun'];

export default function OnboardingPage() {
  const router = useRouter();
  const { api, auth, enqueueEvent, refreshSession } = useAppShell();
  const [step, setStep] = useState<Step>('welcome');
  const [ageBand, setAgeBand] = useState<AgeBand | null>(null);
  const [micGranted, setMicGranted] = useState(false);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [consented, setConsented] = useState(false);
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [authError, setAuthError] = useState(false);
  const { start: recordPlacement } = useVoiceAnswer('placement');

  function finish() {
    markOnboarded();
    router.replace('/');
  }

  async function handleRecordRequested(question: PlacementQuestion): Promise<number> {
    if (question.kind !== 'speak') return 0; // PlacementQuiz only invokes this for 'speak' questions
    const result = await recordPlacement(question.referenceText);
    if (result.status === 'ok' && result.response?.status === 'ok' && result.response?.report?.overall !== null && result.response?.report?.overall !== undefined) {
      return (result.response?.report?.overall ?? 0) / 100;
    }
    return 0;
  }

  async function handlePlacementComplete(placementResult: PlacementResult) {
    setGuestLevel(placementResult.level);
    setResult(placementResult);
    setStep('signin');
  }

  async function sendCode() {
    setAuthError(false);
    const res = await auth.signInWithOtp(email);
    if (res.ok) setCodeSent(true);
    else setAuthError(true);
  }

  async function verifyCode() {
    setAuthError(false);
    const res = await auth.verifyOtp(email, code);
    if (!res.ok) {
      setAuthError(true);
      return;
    }
    refreshSession();
    if (ageBand && consented) {
      await api.postPrivacy({ action: 'accept_consent', version: PRIVACY_CONSENT_VERSION, ageBand });
    }
    if (result) {
      enqueueEvent({ type: 'level_set', eventId: `level-${Date.now()}`, level: result.level });
    }
    setStep('done');
    finish();
  }

  function skipSignIn() {
    setStep('done');
    finish();
  }

  return (
    <div>
      {step === 'welcome' ? (
        <section>
          <h1>{t('onboardingWelcome', 'fr')}</h1>
          <p>{t('onboardingWelcomeBody', 'fr')}</p>
          <button type="button" className="btn" onClick={() => setStep('age')}>
            {t('onboardingStart', 'fr')}
          </button>
        </section>
      ) : null}

      {step === 'age' ? (
        <AgeGate
          onContinue={(band) => {
            setAgeBand(band);
            setGuestAgeBand(band);
            setStep('consent');
          }}
        />
      ) : null}

      {step === 'consent' ? (
        <ConsentSheet
          onAccept={() => {
            setConsented(true);
            setStep('mic');
          }}
          onDecline={() => {
            // Declining consent means mic features (which require a current
            // privacy_consents row server-side, per transcribe.ts's gate) are
            // off the table for this session: route straight into the same
            // no-mic / text-only path MicPermissionGate's onTextModeRequested
            // uses, skipping the mic permission prompt entirely.
            setConsented(false);
            setMicGranted(false);
            setStep('goal');
          }}
        />
      ) : null}

      {step === 'mic' ? (
        <section>
          <h2>{t('onboardingMicAsk', 'fr')}</h2>
          <p>{t('onboardingMicExplain', 'fr')}</p>
          <MicPermissionGate onTextModeRequested={() => { setMicGranted(false); setStep('goal'); }}>
            <MicGrantedNotifier onGranted={() => setMicGranted(true)} />
          </MicPermissionGate>
          <button type="button" className="btn" onClick={() => setStep('goal')}>
            {micGranted ? t('continueLabel', 'fr') : t('onboardingMicLater', 'fr')}
          </button>
        </section>
      ) : null}

      {step === 'goal' ? (
        <section>
          <h2>{t('goalTitle', 'fr')}</h2>
          <div className="chip-row">
            {GOAL_OPTIONS.map((key) => (
              <button key={key} type="button" className="chip" onClick={() => setStep('placement')}>
                {t(key, 'fr')}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 'placement' ? (
        <PlacementQuiz
          questions={PLACEMENT_QUESTIONS}
          speakAllowed={micGranted}
          onRecordRequested={handleRecordRequested}
          onComplete={(placementResult) => void handlePlacementComplete(placementResult)}
        />
      ) : null}

      {step === 'signin' && result ? (
        <section>
          <h2>{t('placementResultTitle', 'fr')}</h2>
          <LevelBadge level={result.level} />
          <p>
            {t('placementResultStartWith', 'fr')} {t(defaultModeFor(result.level) === 'shadowing' ? 'modeShadowing' : defaultModeFor(result.level) === 'roleplay' ? 'modeRoleplay' : 'modeDebate', 'fr')}
          </p>

          <h3>{t('signInTitle', 'fr')}</h3>
          <p>{t('signInBody', 'fr')}</p>

          {!codeSent ? (
            <>
              <label htmlFor="onboarding-email">{t('signInEmailLabel', 'fr')}</label>
              <input id="onboarding-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button type="button" className="btn" onClick={() => void sendCode()}>
                {t('signInSendCode', 'fr')}
              </button>
            </>
          ) : (
            <>
              <p role="status">{t('signInCodeSentNotice', 'fr')}</p>
              <label htmlFor="onboarding-code">{t('signInCodeLabel', 'fr')}</label>
              <input id="onboarding-code" type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
              <button type="button" className="btn" onClick={() => void verifyCode()}>
                {t('signInVerify', 'fr')}
              </button>
            </>
          )}
          {authError ? <p className="banner" data-kind="error">{t('signInError', 'fr')}</p> : null}

          <button type="button" className="btn btn--ghost" onClick={skipSignIn}>
            {t('signInSkip', 'fr')}
          </button>
        </section>
      ) : null}
    </div>
  );
}
