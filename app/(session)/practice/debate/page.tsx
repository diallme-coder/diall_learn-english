// app/(session)/practice/debate/page.tsx: unscripted C1 debate + post-call feedback, design 03
// §5. Push-to-talk ONLY in v1 (same override as roleplay/page.tsx — see that file's header and
// the H3 handback report; the wireframe's "Hands-free"/"Mute" controls need VAD, which v1 does
// not have, so they are not built here).
//
// Three screens share this one route, switched on query params (design 02's route-group
// convention — no separate page.tsx per state):
//   no ?topic=            -> TopicPicker
//   ?topic=<id>            -> the live call (English-only chrome; no hint chips; no LIVE
//                             Franglais side-cards, per scaffoldingFor('C1').debate — design 03
//                             §5 "no side-card live, per C1 unscripted")
//   ?review=<id>            -> DebateFeedbackView, reloaded from IndexedDB (device-local only;
//                             the review is never sent back to the server after it is fetched)
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  AppErrorCode,
  ChatMessage,
  ChatRequest,
  DebateFeedback,
  RephraseFeedback,
  SessionSummary,
} from '../../../../src/lib/types.ts';
import { LIMITS } from '../../../../src/lib/types.ts';
import { DEBATE_TOPICS, getTopic } from '../../../../src/lib/levels/index.ts';
import { t } from '../../../../src/lib/ui/strings.ts';
import { reduceSession, type SessionEvent, type SessionState } from '../../../../src/lib/ui/sessionMachine.ts';
import { rungForAttempt, type ErrorContext, type LadderRung } from '../../../../src/lib/ui/errorLadder.ts';
import { useAppShell } from '../../../../src/components/core/providers.tsx';
import { useVoiceAnswer, type VoiceAnswerResult } from '../../../../src/components/core/useVoiceAnswer.ts';
import MicButton from '../../../../src/components/core/MicButton.tsx';
import TextAnswerInput from '../../../../src/components/core/TextAnswerInput.tsx';
import { useAiSpeech } from '../../../../src/components/conversation/useAiSpeech.ts';
import TopicPicker from '../../../../src/components/conversation/TopicPicker.tsx';
import ChatTranscript, { type TranscriptMessage } from '../../../../src/components/conversation/ChatTranscript.tsx';
import ErrorBanner from '../../../../src/components/conversation/ErrorBanner.tsx';
import DebateFeedbackView from '../../../../src/components/conversation/DebateFeedbackView.tsx';

const CHROME = 'en' as const; // design 02/04: C1 chrome is English-only

function applyEvents(state: SessionState, events: readonly SessionEvent[]): SessionState {
  return reduceSession({ state, mode: 'push_to_talk', elapsedMs: 0, events: [...events] }).state;
}

function wordCount(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function DebatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { api, bucket, dispatchLocal, enqueueEvent, userId } = useAppShell();
  const voice = useVoiceAnswer('chat');
  const aiSpeech = useAiSpeech(api);

  const reviewId = searchParams.get('review');
  const queryTopic = searchParams.get('topic');
  const [topicId, setTopicId] = useState<string | null>(queryTopic ?? null);

  const [preparingReview, setPreparingReview] = useState(false);

  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [errorRung, setErrorRung] = useState<LadderRung | null>(null);
  const [textAnswerMode, setTextAnswerMode] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const noSpeechAttempt = useRef(0);
  const upstreamAttempt = useRef(0);
  const micAttempt = useRef(0);
  const startedAtRef = useRef(Date.now());
  const wordsSpokenRef = useRef(0);
  const userTurnsRef = useRef<string[]>([]);
  const chatHistoryRef = useRef<ChatMessage[]>([]);

  const topic = topicId ? getTopic(topicId) : undefined;
  // `bucket` already resolves to the current user's (or guest's) UserLocalState — see
  // providers.tsx — so a past review just needs its id looked up directly, no manual IndexedDB
  // read or userId keying here.
  const review: DebateFeedback | null = reviewId ? bucket.debateReviews[reviewId] ?? null : null;
  const reviewError = Boolean(reviewId) && !review;

  // ───────── live-call elapsed timer ─────────
  useEffect(() => {
    if (!topic || reviewId) return;
    const id = window.setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 1000);
    return () => window.clearInterval(id);
  }, [topic, reviewId]);

  // ───────── listening -> thinking as soon as the recorder actually stops ─────────
  useEffect(() => {
    if (!voice.recording && sessionState === 'listening') {
      setSessionState((s) => applyEvents(s, [{ type: 'ptt_stop' }]));
    }
  }, [voice.recording, sessionState]);

  const appendUserMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), speaker: 'user', speakerLabel: '', text }]);
  }, []);

  const appendAssistantMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), speaker: 'ai', speakerLabel: 'AI', text }]);
  }, []);

  const handleUpstreamError = useCallback((code: AppErrorCode) => {
    const context: ErrorContext =
      code === 'rate_limited' ? 'rate-limited' : code === 'upstream_timeout' ? 'upstream-timeout' : 'upstream-error';
    upstreamAttempt.current += 1;
    setErrorRung(rungForAttempt(context, upstreamAttempt.current));
    setSessionState((s) => applyEvents(s, [{ type: 'error_occurred' }]));
  }, []);

  const startTopic = useCallback(
    (id: string) => {
      setTopicId(id);
      router.replace(`/practice/debate?topic=${id}`);
      const picked = getTopic(id);
      if (!picked) return;
      startedAtRef.current = Date.now();
      userTurnsRef.current = [];
      chatHistoryRef.current = [];
      appendAssistantMessage(picked.motionEn);
      setSessionState((s) =>
        applyEvents(s, [{ type: 'retry' }, { type: 'ptt_start' }, { type: 'ptt_stop' }, { type: 'thinking_done' }]),
      );
      aiSpeech.speak(picked.motionEn, 1, () => {
        setSessionState((s) => applyEvents(s, [{ type: 'speaking_done' }]));
      });
    },
    [router, appendAssistantMessage, aiSpeech],
  );

  const sendToChat = useCallback(
    async (userText: string) => {
      if (!topicId) return;
      userTurnsRef.current = [...userTurnsRef.current, userText].slice(0, LIMITS.maxDebateTurns);
      // Unlike the live card-skipping below, full conversational context still matters here —
      // debate is unscripted, so the model needs the prior exchange to reply coherently, same
      // windowing (last LIMITS.chatHistoryWindow messages) as roleplay/page.tsx's sendToChat.
      const nextHistory: ChatMessage[] = [...chatHistoryRef.current, { role: 'user', content: userText }].slice(
        -LIMITS.chatHistoryWindow,
      );
      chatHistoryRef.current = nextHistory;
      const req: ChatRequest = { action: 'reply', mode: 'debate', level: 'C1', topicId, messages: nextHistory };
      const res = await api.chat(req);
      if (!res.ok) {
        handleUpstreamError(res.error.code);
        return;
      }
      const chatResponse = res.value;
      if (chatResponse.action !== 'reply') return;
      // design 03 §5: no LIVE Franglais side-cards at C1 — chatResponse.codeSwitch is still
      // returned by the server, but intentionally unused here; the full set is recomputed by
      // the debate_feedback call at end-of-call and shown in the post-call review instead.
      chatHistoryRef.current = [...nextHistory, { role: 'assistant', content: chatResponse.reply }].slice(
        -LIMITS.chatHistoryWindow,
      );
      appendAssistantMessage(chatResponse.reply);
      setSessionState((s) => applyEvents(s, [{ type: 'thinking_done' }]));
      aiSpeech.speak(chatResponse.reply, 1, () => {
        setSessionState((s) => applyEvents(s, [{ type: 'speaking_done' }]));
      });
    },
    [api, topicId, handleUpstreamError, appendAssistantMessage, aiSpeech],
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
      const { transcript } = result.response;
      wordsSpokenRef.current += wordCount(transcript.text);
      appendUserMessage(transcript.text);
      void sendToChat(transcript.text);
    },
    [appendUserMessage, handleUpstreamError, sendToChat],
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

  const requestFeedback = useCallback(async () => {
    if (!topicId) return;
    setPreparingReview(true);
    const res = await api.chat({
      action: 'debate_feedback',
      level: 'C1',
      topicId,
      userTurns: userTurnsRef.current,
    });
    setPreparingReview(false);
    if (!res.ok) {
      handleUpstreamError(res.error.code);
      return;
    }
    const chatResponse = res.value;
    if (chatResponse.action !== 'debate_feedback') return;

    const newReviewId = crypto.randomUUID();
    dispatchLocal({ type: 'debate_review_saved', userId, reviewId: newReviewId, feedback: chatResponse.feedback });

    const summary: SessionSummary = {
      id: crypto.randomUUID(),
      kind: 'debate',
      level: 'C1',
      scenarioId: null,
      topicId,
      startedAt: startedAtRef.current,
      endedAt: Date.now(),
      wordsSpoken: wordsSpokenRef.current,
      codeSwitchCount: chatResponse.feedback.codeSwitchCards.length,
      pronunciationAvg: null,
    };
    enqueueEvent({ eventId: crypto.randomUUID(), type: 'session_completed', session: summary });

    router.replace(`/practice/debate?review=${newReviewId}`);
  }, [api, dispatchLocal, enqueueEvent, router, topicId, userId]);

  const handleHearRephrase = useCallback((item: RephraseFeedback) => aiSpeech.speak(item.native, 1, () => {}), [aiSpeech]);
  const handleSayIt = useCallback((item: RephraseFeedback) => aiSpeech.speak(item.native, 1, () => {}), [aiSpeech]);
  const handleHearCard = useCallback(
    (cardId: string) => {
      const card = review?.codeSwitchCards.find((c) => c.id === cardId);
      if (card) aiSpeech.speak(card.englishSuggestion, 1, () => {});
    },
    [aiSpeech, review],
  );

  const statusText = errorRung
    ? t(errorRung.messageKey, CHROME)
    : t(
        sessionState === 'idle'
          ? 'stateIdle'
          : sessionState === 'offline'
            ? 'stateOffline'
            : sessionState === 'denied'
              ? 'stateMicDenied'
              : 'stateError',
        CHROME,
      );

  // ───────── 1. post-call review ─────────
  if (reviewId) {
    if (review) {
      return (
        <DebateFeedbackView feedback={review} chrome={CHROME} onHear={handleHearRephrase} onSayIt={handleSayIt} onHearCard={handleHearCard} />
      );
    }
    if (reviewError) {
      return (
        <div className="page">
          <p>{t('progressLoadError', CHROME)}</p>
        </div>
      );
    }
    return (
      <div className="page">
        <p>{t('loading', CHROME)}</p>
      </div>
    );
  }

  // ───────── 2. preparing the review right after "End" ─────────
  if (preparingReview) {
    return (
      <div className="page">
        <p role="status">{t('loading', CHROME)}</p>
      </div>
    );
  }

  // ───────── 3. topic picker ─────────
  if (!topic) {
    return <TopicPicker topics={DEBATE_TOPICS} chrome={CHROME} onPick={startTopic} />;
  }

  // ───────── 4. the live call ─────────
  const showMicButton = !(textAnswerMode || sessionState === 'denied');

  return (
    <div className="page">
      <div role="banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="btn btn--ghost" onClick={() => void requestFeedback()}>
          {t('endSession', CHROME)}
        </button>
        <span>{formatElapsed(elapsedMs)}</span>
      </div>

      <ChatTranscript messages={messages} />

      {errorRung ? <ErrorBanner rung={errorRung} chrome={CHROME} onRetry={handleRetry} onTextMode={handleTextMode} /> : null}

      {showMicButton ? (
        <MicButton state={sessionState} mode={CHROME} onPress={handleMicToggle} />
      ) : (
        <>
          <p className="status-line" role="status">
            {statusText}
          </p>
          <TextAnswerInput labelKey="ladderTextMode" submitKey="ladderTextMode" mode={CHROME} onSubmit={handleTextSubmit} />
        </>
      )}
      <button type="button" className="btn btn--ghost" onClick={() => setTextAnswerMode((v) => !v)}>
        {t('ladderTextMode', CHROME)}
      </button>
    </div>
  );
}
