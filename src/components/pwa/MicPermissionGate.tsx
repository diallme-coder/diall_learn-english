'use client';

import { useCallback, useEffect, useReducer, useState } from 'react';
import type { ReactNode } from 'react';
import {
  micPermissionReducer,
  MIC_COPY,
  MIC_DENIED_RECOVERY_STEPS_FR,
  MIC_TEXT_MODE_OFFER_FR,
} from '../../lib/pwa/index.ts';
import type { MicPermissionState } from '../../lib/pwa/index.ts';

const RECOVERY_STEPS_LABEL = 'Comment débloquer ?';

interface MicPermissionGateProps {
  children: ReactNode;
  /** Called when the user chooses to continue without the microphone. */
  onTextModeRequested?: () => void;
}

type PermissionsApiState = 'granted' | 'denied' | 'prompt';

/**
 * Gates mic-only UI behind the permission state machine (design 04 §7
 * system ladder, design 05 §7): explains why before the browser prompt,
 * offers retry/steps on denial, and always offers the text-mode escape.
 */
export default function MicPermissionGate({ children, onTextModeRequested }: MicPermissionGateProps) {
  const [state, dispatch] = useReducer(micPermissionReducer, 'unknown' as MicPermissionState);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.isSecureContext) {
      dispatch({ type: 'insecure_context' });
      return;
    }
    const nav = navigator as Navigator & {
      permissions?: { query(opts: { name: string }): Promise<PermissionStatus> };
    };
    if (!nav.permissions?.query) {
      dispatch({ type: 'permissions_api_result', status: 'prompt' });
      return;
    }
    let cancelled = false;
    let status: PermissionStatus | undefined;
    nav.permissions
      .query({ name: 'microphone' })
      .then((result) => {
        if (cancelled) return;
        status = result;
        dispatch({ type: 'permissions_api_result', status: result.state as PermissionsApiState });
        result.onchange = () => {
          dispatch({ type: 'permissions_api_result', status: result.state as PermissionsApiState });
        };
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'permissions_api_result', status: 'prompt' });
      });
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  const requestMic = useCallback(() => {
    dispatch({ type: 'request_start' });
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
        dispatch({ type: 'request_success' });
      })
      .catch((err: { name?: string }) => {
        dispatch({ type: 'request_error', errorName: err?.name ?? 'Unknown' });
      });
  }, []);

  if (state === 'granted') return <>{children}</>;

  const copy = MIC_COPY[state];
  const canRetry = state === 'prompt' || state === 'unavailable' || state === 'in_use';
  const showTextModeOffer =
    state === 'denied' || state === 'unavailable' || state === 'in_use' || state === 'insecure';

  return (
    <div role="region" aria-label={copy.titleFr}>
      <p>{copy.titleFr}</p>
      <p>{copy.bodyFr}</p>

      {canRetry && copy.actionFr ? (
        <button type="button" onClick={requestMic}>
          {copy.actionFr}
        </button>
      ) : null}

      {state === 'denied' ? (
        <>
          <button type="button" onClick={() => setShowSteps((v) => !v)}>
            {RECOVERY_STEPS_LABEL}
          </button>
          {showSteps ? (
            <ol>
              {MIC_DENIED_RECOVERY_STEPS_FR.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
        </>
      ) : null}

      {showTextModeOffer ? (
        <div role="status">
          <p>{MIC_TEXT_MODE_OFFER_FR}</p>
          {onTextModeRequested ? (
            <button type="button" onClick={onTextModeRequested}>
              {state === 'denied' ? copy.actionFr : MIC_TEXT_MODE_OFFER_FR}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
