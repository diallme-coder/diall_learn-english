'use client';

// src/components/core/PlacementQuiz.tsx: onboarding step (plan H2). `speakAllowed` decides
// whether 'speak' questions are shown at all — they are skipped entirely, not merely disabled,
// when signed out / mic denied / offline, and `selfSelectPlacement` is offered as a one-tap
// escape ("Choisir mon niveau moi-même"). `onRecordRequested` returns a spokenScore in [0,1];
// since this unit does not re-score pronunciation itself here, the page wires that to the
// shadowing scoring path (scorePronunciation against the question's short referenceText,
// `report.overall` normalised to 0..1) rather than this component inventing its own scoring.
import { useMemo, useState } from 'react';
import type { CEFRLevel, PlacementAnswer, PlacementQuestion, PlacementResult } from '../../lib/types.ts';
import { scorePlacement, selfSelectPlacement } from '../../lib/levels/placement.ts';
import MicButton from './MicButton.tsx';
import { t, type UiLangMode } from '../../lib/ui/strings.ts';

interface PlacementQuizProps {
  questions: readonly PlacementQuestion[];
  speakAllowed: boolean;
  mode?: UiLangMode;
  onRecordRequested?: (question: PlacementQuestion) => Promise<number>; // resolves a spokenScore 0..1
  onComplete: (result: PlacementResult, answers: readonly PlacementAnswer[]) => void;
}

export default function PlacementQuiz({ questions, speakAllowed, mode = 'fr', onRecordRequested, onComplete }: PlacementQuizProps) {
  const pool = useMemo(() => (speakAllowed ? questions : questions.filter((q) => q.kind !== 'speak')), [questions, speakAllowed]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<PlacementAnswer[]>([]);
  const [recording, setRecording] = useState(false);

  const question = pool[index];

  function submit(answer: PlacementAnswer) {
    const next = [...answers, answer];
    if (index + 1 >= pool.length) {
      onComplete(scorePlacement(next, pool), next);
    } else {
      setAnswers(next);
      setIndex(index + 1);
    }
  }

  async function handleSpeak() {
    if (!question || question.kind !== 'speak' || !onRecordRequested) return;
    setRecording(true);
    const spokenScore = await onRecordRequested(question);
    setRecording(false);
    submit({ questionId: question.id, kind: 'speak', spokenScore });
  }

  function selfSelect(level: CEFRLevel) {
    onComplete(selfSelectPlacement(level), answers);
  }

  if (!question) return null;

  return (
    <section aria-labelledby="placement-title">
      <h2 id="placement-title">{t('placementTitle', mode)}</h2>
      <p className="status-line">
        {t('placementQuestionCounterPrefix', mode)} {index + 1} / {pool.length}
      </p>

      <p lang="en">{question.promptEn}</p>
      {question.promptFr ? <p lang="fr">{question.promptFr}</p> : null}

      {question.kind === 'choice' ? (
        <fieldset>
          <legend className="sr-only">{question.promptEn}</legend>
          {question.options.map((option, i) => (
            <div key={option}>
              <button type="button" className="btn btn--secondary" onClick={() => submit({ questionId: question.id, kind: 'choice', choiceIndex: i })}>
                {option}
              </button>
            </div>
          ))}
        </fieldset>
      ) : (
        <MicButton state={recording ? 'listening' : 'idle'} mode={mode} onPress={() => void handleSpeak()} />
      )}

      <div className="chip-row">
        <button type="button" className="btn btn--ghost" onClick={() => submit({ questionId: question.id, kind: 'dont_know' })}>
          {t('placementDontKnow', mode)}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => selfSelect('B1')}>
          {t('placementSelfSelectCta', mode)}
        </button>
      </div>
    </section>
  );
}
