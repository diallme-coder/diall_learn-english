'use client';

// src/components/core/MicButton.tsx: the push-to-talk / barge-in control shared by every voice
// screen (design 03 §0 global state matrix, design 05 §3). A native <button>; state is exposed
// via aria-label + data-state (styling only) — the toggle attribute design 05 line 34 forbids
// here is enforced mechanically by check-boundaries rule 9. The status line next to it is a
// role="status" aria-live region, suppressed while recording when the user has turned on
// `silenceAnnouncementsWhileRecording` (the screen-reader's own voice would be captured by the
// mic otherwise).
import type { SessionState } from '../../lib/ui/sessionMachine.ts';
import { t, type UiLangMode } from '../../lib/ui/strings.ts';
import styles from './MicButton.module.css';

const LABEL_KEY: Record<SessionState, 'stateIdle' | 'stateListening' | 'stateThinking' | 'stateSpeaking' | 'stateError' | 'stateOffline' | 'stateMicDenied'> = {
  idle: 'stateIdle',
  listening: 'stateListening',
  thinking: 'stateThinking',
  speaking: 'stateSpeaking',
  error: 'stateError',
  offline: 'stateOffline',
  denied: 'stateMicDenied',
};

interface MicButtonProps {
  state: SessionState;
  mode?: UiLangMode;
  onPress: () => void;
  silenceAnnouncements?: boolean;
  disabled?: boolean;
}

export default function MicButton({ state, mode = 'fr', onPress, silenceAnnouncements = false, disabled = false }: MicButtonProps) {
  const label = state === 'speaking' ? t('interrupt', mode) : t(LABEL_KEY[state], mode);
  const suppressStatus = silenceAnnouncements && state === 'listening';

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className="mic-button"
        data-state={state}
        aria-label={label}
        onClick={onPress}
        disabled={disabled || state === 'thinking' || state === 'offline' || state === 'denied'}
      >
        {state === 'listening' ? (
          <span className="mic-wave" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
        ) : (
          <svg className="mic-button__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z" />
          </svg>
        )}
      </button>
      <p className="status-line" role="status" aria-live={suppressStatus ? 'off' : 'polite'}>
        {label}
      </p>
    </div>
  );
}
