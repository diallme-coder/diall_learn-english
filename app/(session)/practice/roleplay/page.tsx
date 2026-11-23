// app/(session)/practice/roleplay/page.tsx: guided roleplay (B1-B2), design 03 §4 / 04.
//
// Turn loop (push-to-talk ONLY in v1 — docs/PLAN.md's realtime-deferred decision overrides
// design 04 §1's hands-free default for B1-B2; see the H3 handback report):
//   idle -[tap mic]-> listening -[tap mic]-> thinking -[transcribe ok]-> (chat) -> speaking
//   -[TTS ends]-> idle
// `src/lib/ui/sessionMachine.ts`'s `reduceSession` drives every one of those transitions; this
// page never sets `sessionState` without going through it, one real event at a time, except for
// the scenario's opening line (the AI speaks first, with no prior listening/thinking phase).
//
// Shared client plumbing (api/auth/local store/outbox, the mic-capture-to-transcribe loop, the
// mic button, the text-answer fallback) comes from H2's `src/components/core/*`, which had not
// landed yet when this unit started and so is adopted here rather than re-duplicated — see the
// H3 handback report for the integration note.
'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  AppErrorCode,
  CEFRLevel,
  ChatMessage,
  ChatRequest,
  Hint,
  ScenarioId,
  SessionSummary,
} from '../../../../src/lib/types.ts';
import { LIMITS, SCENARIO_IDS, isOneOf } from '../../../../src/lib/types.ts';
import { SCENARIOS, getScenario, hintsFor } from '../../../../src/lib/levels/index.ts';
import { t } from '../../../../src/lib/ui/strings.ts';
import { reduceSession, type SessionEvent, type SessionState } from '../../../../src/lib/ui/sessionMachine.ts';
import { rungForAttempt, type ErrorContext, type LadderRung } from '../../../../src/lib/ui/errorLadder.ts';
import {
  EMPTY_SIDE_CARD_QUEUE,
  dismissSideCard,
  enqueueSideCard,
  tickSideCardQueue,
  type SideCardQueueState,
} from '../../../../src/lib/ui/sideCardQueue.ts';
import { useAppShell } from '../../../../src/components/core/providers.tsx';
import { useVoiceAnswer, type VoiceAnswerResult } from '../../../../src/components/core/useVoiceAnswer.ts';
import MicButton from '../../../../src/components/core/MicButton.tsx';
import TextAnswerInput from '../../../../src/components/core/TextAnswerInput.tsx';
import { useAiSpeech } from '../../../../src/components/conversation/useAiSpeech.ts';
import ScenarioPicker from '../../../../src/components/conversation/ScenarioPicker.tsx';
import ChatTranscript, { type TranscriptMessage } from '../../../../src/components/conversation/ChatTranscript.tsx';
import ErrorBanner from '../../../../src/components/conversation/ErrorBanner.tsx';
import HintChips from '../../../../src/components/conversation/HintChips.tsx';
import SideCardStack from '../../../../src/components/conversation/SideCardStack.tsx';

const TO_SPEAKING: readonly SessionEvent[] = [
  { type: 'retry' },
  { type: 'ptt_start' },
  { type: 'ptt_stop' },
  { type: 'thinking_done' },
];

function applyEvents(state: SessionState, events: readonly SessionEvent[]): SessionState {
  return reduceSession({ state, mode: 'push_to_talk', elapsedMs: 0, events: [...events] }).state;
}

function wordCount(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

function RoleplayPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { api, settings, enqueueEvent } = useAppShell();
  const voice = useVoiceAnswer('chat');
  const aiSpeech = useAiSpeech(api);

  const queryScenario = searchParams.get('scenario');
  const [scenarioId, setScenarioId] = useState<ScenarioId | null>(
    queryScenario && isOneOf(SCENARIO_IDS, queryScenario) ? queryScenario : null,
  );
  const [level, setLevel] = useState<CEFRLevel>('B1');
  const [textAnswerMode, setTextAnswerMode] = useState(settings.textAnswerMode);

  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [errorRung, setErrorRung] = useState<LadderRung | null>(null);
  const [sideCardQueue, setSideCardQueue] = useState<SideCardQueueState>(EMPTY_SIDE_CARD_QUEUE);
  const [hintSheet, setHintSheet] = useState<Hint | null>(null);

  const chrome = 'bi' as const; // design 04 §10: bilingual chrome at B1-B2

  const chatHistoryRef = useRef<ChatMessage[]>([]);
  const noSpeechAttempt = useRef(0);
  const upstreamAttempt = useRef(0);
  const micAttempt = useRef(0);
  const idleSinceRef = useRef<number>(Date.now());
  const wordsSpokenRef = useRef(0);
  const codeSwitchCountRef = useRef(0);
  const startedAtRef = useRef(Date.now());

  // ───────── level from the server (AppShellValue carries settings but not the profile level) ──
  useEffect(() => {
    void api.getProgress(new Date().getTimezoneOffset()).then((res) => {
      if (res.ok && (res.value.profile.level === 'B1' || res.value.profile.level === 'B2')) {
        setLevel(res.value.profile.level);
      }
    });
  }, [api]);

  // ───────── listening -> thinking as soon as the recorder actually stops (useVoiceAnswer's
  // `recording` flips false right when MediaRecorder.onstop fires, before transcribe() even
  // starts) ─────────
  useEffect(() => {
    if (!voice.recording && sessionState === 'listening') {
      setSessionState((s) => applyEvents(s, [{ type: 'ptt_stop' }]));
    }
  }, [voice.recording, sessionState]);

  // ───────── idle silence nudges (design 04 §2's ladder, re-anchored to "idle waiting for the
  // user to press the mic" rather than "mid-recording" — push-to-talk has no silence mid-turn
  // for the app to detect, since the user decides when to stop; see the H3 handback report).
  // Hint chips themselves are always shown at idle (design 03 §4's wireframe has "Suggestions"
  // as a standing part of the layout, not gated behind a timer) — the only thing the nudge
  // ladder still does here is escalate to the text-answer fallback at the 25s "exit" rung. ─────
  useEffect(() => {
    if (sessionState !== 'idle' || scenarioId === null) return;
    idleSinceRef.current = Date.now();
    const id = window.setInterval(() => {
      if (Date.now() - idleSinceRef.current >= 25_000) setTextAnswerMode(true);
    }, 1000);
    return () => window.clearInterval(id);
  }, [sessionState, scenarioId]);

  // ───────── Franglais side-card queue ticking (auto-collapse after 6s) ─────────
  useEffect(() => {
    const id = window.setInterval(() => {
      setSideCardQueue((q) => tickSideCardQueue(q, Date.now(), { sideCardAutoCollapse: settings.sideCardAutoCollapse }));
    }, 1000);
    return () => window.clearInterval(id);
  }, [settings.sideCardAutoCollapse]);

  const scenario = scenarioId ? getScenario(scenarioId) : undefined;
  const hints = scenario ? hintsFor(scenario.id, level) : undefined;

  const appendUserMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), speaker: 'user', speakerLabel: '', text }]);
  }, []);

  const appendAssistantMessage = useCallback(
    (text: string) => {
      // aiRoleEn is a full description ("Alex, a friendly barista…"); the bubble only needs the
      // name, per design 03 §4's wireframe ("Alex" label on the AI bubble).
      const aiName = scenario ? scenario.aiRoleEn.split(',')[0] ?? scenario.aiRoleEn : 'AI';
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), speaker: 'ai', speakerLabel: aiName, text }]);
    },
    [scenario],
  );

  const startScenario = useCallback(
    (id: ScenarioId) => {
      setScenarioId(id);
      router.replace(`/practice/roleplay?scenario=${id}`);
      const picked = getScenario(id);
      if (!picked) return;
      startedAtRef.current = Date.now();
      appendAssistantMessage(picked.openingLineEn);
      setSessionState((s) => applyEvents(s, TO_SPEAKING));
      aiSpeech.speak(picked.openingLineEn, settings.playbackRate, () => {
        setSessionState((s) => applyEvents(s, [{ type: 'speaking_done' }]));
      });
    },
    [router, appendAssistantMessage, aiSpeech, settings.playbackRate],
  );

  const handleUpstreamError = useCallback((code: AppErrorCode) => {
    const context: ErrorContext =
      code === 'rate_limited' ? 'rate-limited' : code === 'upstream_timeout' ? 'upstream-timeout' : 'upstream-error';
    upstreamAttempt.current += 1;
    setErrorRung(rungForAttempt(context, upstreamAttempt.current));
    setSessionState((s) => applyEvents(s, [{ type: 'error_occurred' }]));
  }, []);

  const sayAssistantLine = useCallback(
    (text: string) => {
      appendAssistantMessage(text);
      setSessionState((s) => applyEvents(s, [{ type: 'thinking_done' }]));
      aiSpeech.speak(text, settings.playbackRate, () => {
        setSessionState((s) => applyEvents(s, [{ type: 'speaking_done' }]));
      });
    },
    [appendAssistantMessage, aiSpeech, settings.playbackRate],
  );

  const sendToChat = useCallback(
    async (userText: string) => {
      const nextHistory: ChatMessage[] = [...chatHistoryRef.current, { role: 'user' as const, content: userText }].slice(
        -LIMITS.chatHistoryWindow,
      );
      chatHistoryRef.current = nextHistory;
      if (!scenarioId) return;
      const req: ChatRequest = { action: 'reply', mode: 'roleplay', level, scenarioId, messages: nextHistory };
      const res = await api.chat(req);
      if (!res.ok) {
        handleUpstreamError(res.error.code);
        return;
      }
      const chatResponse = res.value;
      if (chatResponse.action !== 'reply') return;
      const codeSwitch = chatResponse.codeSwitch;
      if (codeSwitch) {
        setMessages((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i -= 1) {
            if (next[i]!.speaker === 'user') {
              next[i] = { ...next[i]!, frenchSpans: codeSwitch.spans };
              break;
            }
          }
          return next;
        });
        for (const card of codeSwitch.cards) setSideCardQueue((q) => enqueueSideCard(q, card, Date.now()));
        codeSwitchCountRef.current += codeSwitch.cards.length;
      }
      chatHistoryRef.current = [...nextHistory, { role: 'assistant' as const, content: chatResponse.reply }].slice(
        -LIMITS.chatHistoryWindow,
      );
      sayAssistantLine(chatResponse.reply);
    },
    [api, level, scenarioId, handleUpstreamError, sayAssistantLine],
  );

  const handleVoiceResult = useCallback(
    (result: VoiceAnswerResult) => {
      if (result.status === 'denied') {
        micAttempt.current += 1;
        setErrorRung(rungForAttempt('mic-denied', micAttempt.current));
        setTextAnswerMode(true);
        setSessionState((s) => applyEvents(s, [{ type: 'mic_denied' }]));
        return;
      }
      if (result.status === 'error') {
        handleUpstreamError('upstream_error');
        return;
      }
      if (result.status === 'no_speech' || result.status === 'too_quiet' || !result.response || result.response.status === 'no_speech') {
        noSpeechAttempt.current += 1;
        setErrorRung(rungForAttempt('no_speech', noSpeechAttempt.current));
        setSessionState((s) => applyEvents(s, [{ type: 'error_occurred' }, { type: 'retry' }]));
        return;
      }
      noSpeechAttempt.current = 0;
      const { transcript, codeSwitch } = result.response;
      // allFrench is checked on the TRANSCRIBE-time analysis (gates whether /api/chat is even
      // called, design 04 §4 step 5), separately from the CHAT response's own codeSwitch (which
      // drives the side-card queue after the reply renders) — see the H3 handback report.
      if (codeSwitch.allFrench) {
        sayAssistantLine(t('speechLadderFrenchOnly', chrome));
        return;
      }
      wordsSpokenRef.current += wordCount(transcript.text);
      appendUserMessage(transcript.text);
      void sendToChat(transcript.text);
    },
    [appendUserMessage, handleUpstreamError, sayAssistantLine, sendToChat],
  );

  const handleMicToggle = useCallback(() => {
    if (sessionState === 'listening') {
      voice.stop();
      return;
    }
    if (sessionState === 'speaking') {
      aiSpeech.interrupt();
      setSessionState((s) => applyEvents(s, [{ type: 'speaking_done' }, { type: 'ptt_start' }]));
    } else if (sessionState === 'idle') {
      setErrorRung(null);
      setSessionState((s) => applyEvents(s, [{ type: 'ptt_start' }]));
    } else {
      return;
    }
    void voice.start().then(handleVoiceResult);
  }, [sessionState, voice, aiSpeech, handleVoiceResult]);

  const handleRetry = useCallback(() => {
    setErrorRung(null);
    setSessionState((s) => applyEvents(s, [{ type: 'retry' }]));
  }, []);

  const handleTextMode = useCallback(() => {
    setErrorRung(null);
    setTextAnswerMode(true);
    setSessionState((s) => applyEvents(s, [{ type: 'retry' }]));
  }, []);

  const handleTextSubmit = useCallback(
    (text: string) => {
      setErrorRung(null);
      setSessionState((s) => applyEvents(s, [{ type: 'retry' }, { type: 'ptt_start' }, { type: 'ptt_stop' }]));
      wordsSpokenRef.current += wordCount(text);
      appendUserMessage(text);
      void sendToChat(text);
    },
    [appendUserMessage, sendToChat],
  );

  const handleEndSession = useCallback(() => {
    if (scenarioId) {
      const summary: SessionSummary = {
        id: crypto.randomUUID(),
        kind: 'roleplay',
        level,
        scenarioId,
        topicId: null,
        startedAt: startedAtRef.current,
        endedAt: Date.now(),
        wordsSpoken: wordsSpokenRef.current,
        codeSwitchCount: codeSwitchCountRef.current,
        pronunciationAvg: null,
      };
      enqueueEvent({ eventId: crypto.randomUUID(), type: 'session_completed', session: summary });
    }
    router.push('/');
  }, [enqueueEvent, level, scenarioId, router]);

  const statusText = errorRung
    ? t(errorRung.messageKey, chrome)
    : t(
        sessionState === 'idle'
          ? 'stateIdle'
          : sessionState === 'offline'
            ? 'stateOffline'
            : sessionState === 'denied'
              ? 'stateMicDenied'
              : 'stateError',
        chrome,
      );

  if (!scenario) {
    return <ScenarioPicker scenarios={SCENARIOS} chrome={chrome} onPick={startScenario} />;
  }

  const showMicButton = !(textAnswerMode || sessionState === 'denied');

  return (
    <div className="page">
      <div role="banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="btn btn--ghost" onClick={handleEndSession}>
          {t('endSession', chrome)}
        </button>
        <span lang="en">{scenario.titleEn}</span>
      </div>

      <ChatTranscript messages={messages} />

      <SideCardStack
        queue={sideCardQueue}
        chrome={chrome}
        onHear={(cardId) => {
          const card = [...sideCardQueue.visible, ...sideCardQueue.collapsed].find((e) => e.card.id === cardId)?.card;
          if (card) aiSpeech.speak(card.englishSuggestion, settings.playbackRate, () => {});
        }}
        onRepeat={(cardId) => {
          const card = [...sideCardQueue.visible, ...sideCardQueue.collapsed].find((e) => e.card.id === cardId)?.card;
          if (card) aiSpeech.speak(card.englishSuggestion, settings.playbackRate, () => {});
        }}
        onSave={(cardId) => {
          const card = [...sideCardQueue.visible, ...sideCardQueue.collapsed].find((e) => e.card.id === cardId)?.card;
          if (!card) return;
          enqueueEvent({
            eventId: crypto.randomUUID(),
            type: 'franglais_saved',
            frenchTerm: card.frenchSpan,
            englishTerm: card.englishSuggestion,
          });
        }}
        onDismiss={(cardId) => setSideCardQueue((q) => dismissSideCard(q, cardId))}
        onNotFrench={(cardId) => setSideCardQueue((q) => dismissSideCard(q, cardId))}
      />

      {errorRung ? <ErrorBanner rung={errorRung} chrome={chrome} onRetry={handleRetry} onTextMode={handleTextMode} /> : null}

      {hints && sessionState === 'idle' ? (
        <HintChips hints={hints} chrome={chrome} onPlay={(hint) => aiSpeech.speak(hint.en, 1, () => {})} onExplain={setHintSheet} />
      ) : null}
      {hintSheet ? (
        <div role="note" aria-label={t('hintExplanationLabel', chrome)}>
          <p lang="fr">{hintSheet.explanationFr}</p>
          <button type="button" className="btn btn--ghost" onClick={() => setHintSheet(null)}>
            {t('sideCardDismiss', chrome)}
          </button>
        </div>
      ) : null}

      {showMicButton ? (
        <MicButton
          state={sessionState}
          mode={chrome}
          onPress={handleMicToggle}
          silenceAnnouncements={settings.silenceAnnouncementsWhileRecording}
        />
      ) : (
        <>
          <p className="status-line" role="status">
            {statusText}
          </p>
          <TextAnswerInput
            labelKey="ladderTextMode"
            submitKey="ladderTextMode"
            mode={chrome}
            onSubmit={handleTextSubmit}
          />
        </>
      )}
      <button type="button" className="btn btn--ghost" onClick={() => setTextAnswerMode((v) => !v)}>
        {t('ladderTextMode', chrome)}
      </button>
    </div>
  );
}

// useSearchParams() opts this page out of static rendering, which Next.js requires to be
// scoped behind a Suspense boundary (https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout).
export default function RoleplayPage() {
  return (
    <Suspense fallback={null}>
      <RoleplayPageInner />
    </Suspense>
  );
}
