'use client';

// src/components/core/DrillRunner.tsx: the 2-minute micro-drill loop (design 03 §7, plan H2).
// `effectiveInputMode` is decided by the caller (offline or guest -> 'self_check'; else
// settings.textAnswerMode -> 'typed'; else 'spoken') and passed in as `inputMode`, so this
// component itself has no connectivity/auth logic. Every attempt is reported via `onAttempt`
// so the page can push it through H1's outbox (`drill_attempt` ProgressEvent) itself.
import { useMemo, useState } from 'react';
import type { DrillAttempt, DrillCheckResult, DrillItem, InputMode } from '../../lib/types.ts';
import { checkAnswer } from '../../lib/drills/checker.ts';
import { gradeFromResult } from '../../lib/srs/scheduler.ts';
import TextAnswerInput from './TextAnswerInput.tsx';
import MicButton from './MicButton.tsx';
import { t, type UiLangMode } from '../../lib/ui/strings.ts';
import styles from './DrillRunner.module.css';

interface DrillRunnerProps {
  items: readonly DrillItem[];
  inputMode: InputMode;
  mode?: UiLangMode;
  onRecordRequested?: () => Promise<string | null>; // records + transcribes; null = no speech / failed
  onSpeakNative?: (text: string) => void;
  onAttempt: (attempt: DrillAttempt, result: DrillCheckResult) => void;
  onFinish: () => void;
}

type Phase = 'answering' | 'confirming' | 'feedback';

export default function DrillRunner({
  items,
  inputMode,
  mode = 'fr',
  onRecordRequested,
  onSpeakNative,
  onAttempt,
  onFinish,
}: DrillRunnerProps) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('answering');
  const [pendingResult, setPendingResult] = useState<DrillCheckResult | null>(null);
  const [pendingRaw, setPendingRaw] = useState<string>('');
  const [startedAt] = useState(() => Date.now());
  const [recording, setRecording] = useState(false);

  const item = items[index];
  const total = items.length;

  const progressPct = useMemo(() => (total === 0 ? 0 : Math.round(((index + (phase === 'feedback' ? 1 : 0)) / total) * 100)), [index, phase, total]);

  function recordAttempt(result: DrillCheckResult, correctOverride?: boolean) {
    if (!item) return;
    const durationMs = Date.now() - startedAt;
    const correct = correctOverride ?? result.correct;
    const attempt: DrillAttempt = {
      id: `${item.id}-${startedAt}-${index}`,
      itemId: item.id,
      answer: inputMode === 'self_check' ? null : pendingRaw || result.normalizedAnswer,
      correct,
      grade: gradeFromResult({ ...result, correct }, durationMs),
      durationMs,
      inputMode,
      answeredAt: Date.now(),
    };
    onAttempt(attempt, result);
    setPendingResult(result);
    setPhase('feedback');
  }

  function handleTyped(value: string) {
    if (!item) return;
    setPendingRaw(value);
    const result = checkAnswer(item, value, 'typed');
    recordAttempt(result);
  }

  async function handleSpeak() {
    if (!item || !onRecordRequested) return;
    setRecording(true);
    const heard = await onRecordRequested();
    setRecording(false);
    if (heard === null) return;
    setPendingRaw(heard);
    const result = checkAnswer(item, heard, 'spoken');
    if (result.verdict === 'confirm') {
      setPendingResult(result);
      setPhase('confirming');
    } else {
      recordAttempt(result);
    }
  }

  function handleSelfCheck(saidIt: boolean) {
    if (!item) return;
    const result = checkAnswer(item, '', 'self_check');
    recordAttempt(result, saidIt);
  }

  function handleConfirm(confirmed: boolean) {
    if (!pendingResult) return;
    recordAttempt(pendingResult, confirmed);
  }

  function next() {
    setPhase('answering');
    setPendingResult(null);
    setPendingRaw('');
    if (index + 1 >= total) onFinish();
    else setIndex(index + 1);
  }

  if (!item) return null;

  return (
    <div>
      <div className={styles.progress}>
        <div className={styles.progressFill} style={{ inlineSize: `${progressPct}%` }} />
      </div>

      {phase === 'answering' ? (
        <>
          <p className="status-line">{t('drillsPromptLabel', mode)}</p>
          <p className={styles.prompt} lang="fr">« {item.promptFr} »</p>
          <p className="status-line">{t('drillsAnswerLabel', mode)}</p>

          {inputMode === 'typed' ? <TextAnswerInput onSubmit={handleTyped} autoFocus /> : null}

          {inputMode === 'spoken' ? (
            <MicButton state={recording ? 'listening' : 'idle'} mode={mode} onPress={() => void handleSpeak()} />
          ) : null}

          {inputMode === 'self_check' ? (
            <div className="chip-row">
              <button type="button" className="btn" onClick={() => handleSelfCheck(true)}>
                {t('drillsSelfCheckYes', mode)}
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => handleSelfCheck(false)}>
                {t('drillsSelfCheckNo', mode)}
              </button>
            </div>
          ) : null}

          <div>
            <button type="button" className="btn btn--ghost" onClick={() => handleSelfCheck(false)}>
              {t('drillsDontKnow', mode)}
            </button>
          </div>
        </>
      ) : null}

      {phase === 'confirming' && pendingResult ? (
        <div role="status">
          <p>
            {t('drillsConfirmQuestion', mode)} « {pendingRaw} » ?
          </p>
          <div className="chip-row">
            <button type="button" className="btn" onClick={() => handleConfirm(true)}>
              {t('drillsConfirmYes', mode)}
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => handleConfirm(false)}>
              {t('drillsConfirmNo', mode)}
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'feedback' && pendingResult ? (
        <div className={styles.feedback}>
          {pendingResult.correct ? (
            <p>✓ {item.correctEn}</p>
          ) : (
            <>
              <p>
                {t('drillsTrapLabel', mode)}: <span className={styles.trapStrike} lang="en">{item.literalTrapEn}</span>
              </p>
              <p lang="fr">{item.explanationFr}</p>
              <p lang="en">✓ {item.correctEn}</p>
            </>
          )}
          {onSpeakNative ? (
            <button type="button" className="btn btn--ghost" onClick={() => onSpeakNative(item.correctEn)}>
              {t('drillsListenNative', mode)}
            </button>
          ) : null}
          <div>
            <button type="button" className="btn" onClick={next}>
              {t('next', mode)}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
