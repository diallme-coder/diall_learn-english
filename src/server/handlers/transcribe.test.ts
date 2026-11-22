import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transcribeHandler } from './transcribe.ts';
import { buildFakeDeps } from '../deps.ts';
import { fakeJwt, makeMultipartRequest } from '../fixtures/requests.ts';
import { createFakeAuth, createFakeTranscriber, createInMemoryPrivacyStore } from '../../lib/ports/index.ts';
import type { PrivacyExport, Transcript } from '../../lib/types.ts';
import type { ServerDeps } from '../deps.ts';

const ORIGIN = 'https://parle-to-speak.app';
const URL = 'https://parle-to-speak.app/api/transcribe';

function authedDeps(): { deps: ServerDeps; token: string } {
  const deps = buildFakeDeps({ allowedOrigins: [ORIGIN] });
  const token = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
  deps.auth = createFakeAuth({ [token]: { userId: 'u1', accessToken: token } });
  return { deps, token };
}

function okTranscript(text: string): Transcript {
  return { text, language: 'en', words: [], durationSec: 1 };
}

function emptyPrivacyExport(exportedAt: number): PrivacyExport {
  return {
    exportedAt,
    profile: { level: null, nativeLang: 'fr', ageBand: null, consent: null, settings: {
      captionsOn: true, playbackRate: 0.85, textAnswerMode: false, sideCardAutoCollapse: true,
      silenceAnnouncementsWhileRecording: true,
    } },
    sessions: [], vocabulary: [], weakPhonemes: [], drillAttempts: [], srsCards: [], consents: [],
  };
}

test('transcribeHandler: no_speech short-circuits (high noSpeechProb), no progress.record call', async () => {
  const { deps, token } = authedDeps();
  deps.transcriber = createFakeTranscriber([{ ok: true, value: { ...okTranscript('...'), noSpeechProb: 0.9 } }]);
  const req = makeMultipartRequest(
    URL,
    { purpose: 'chat', audio: { bytes: new Uint8Array([1, 2, 3]), mimeType: 'audio/webm', filename: 'a.webm' } },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const res = await transcribeHandler(req, deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { status: 'no_speech' });
});

test('transcribeHandler: a known Whisper hallucination string also short-circuits to no_speech', async () => {
  const { deps, token } = authedDeps();
  deps.transcriber = createFakeTranscriber([
    { ok: true, value: { ...okTranscript('Thanks for watching!'), noSpeechProb: 0.01 } },
  ]);
  const req = makeMultipartRequest(
    URL,
    { purpose: 'chat', audio: { bytes: new Uint8Array([1]), mimeType: 'audio/webm', filename: 'a.webm' } },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const res = await transcribeHandler(req, deps);
  const body = await res.json();
  assert.deepEqual(body, { status: 'no_speech' });
});

test('transcribeHandler: an ok transcript returns codeSwitch and null report with no referenceText', async () => {
  const { deps, token } = authedDeps();
  deps.transcriber = createFakeTranscriber([
    { ok: true, value: { ...okTranscript('I want a croissant please'), noSpeechProb: 0.01 } },
  ]);
  const req = makeMultipartRequest(
    URL,
    { purpose: 'chat', audio: { bytes: new Uint8Array([1]), mimeType: 'audio/webm', filename: 'a.webm' } },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const res = await transcribeHandler(req, deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.report, null);
  assert.ok(body.codeSwitch);
});

test('transcribeHandler: with referenceText, scores pronunciation and records progress', async () => {
  const { deps, token } = authedDeps();
  deps.transcriber = createFakeTranscriber([
    {
      ok: true,
      value: {
        text: 'hungry',
        language: 'en',
        words: [{ text: 'hungry', startSec: 0, endSec: 0.5, confidence: 0.9 }],
        durationSec: 0.5,
        noSpeechProb: 0.01,
      },
    },
  ]);
  const req = makeMultipartRequest(
    URL,
    {
      purpose: 'pronunciation',
      referenceText: 'hungry',
      audio: { bytes: new Uint8Array([1]), mimeType: 'audio/webm', filename: 'a.webm' },
    },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const res = await transcribeHandler(req, deps);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.ok(body.report);
  // @ts-expect-error -- fake progress store exposes recordedEvents for assertions
  assert.equal(deps.progress.recordedEvents.length, 1);
  // @ts-expect-error
  assert.equal(deps.progress.recordedEvents[0].event.type, 'pronunciation_report');
});

test('transcribeHandler: current privacy consent present proceeds normally', async () => {
  const { deps, token } = authedDeps();
  deps.privacy = createInMemoryPrivacyStore(emptyPrivacyExport(deps.clock.now()), deps.clock, 'granted');
  deps.transcriber = createFakeTranscriber([
    { ok: true, value: { ...okTranscript('I want a croissant please'), noSpeechProb: 0.01 } },
  ]);
  const req = makeMultipartRequest(
    URL,
    { purpose: 'chat', audio: { bytes: new Uint8Array([1]), mimeType: 'audio/webm', filename: 'a.webm' } },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const res = await transcribeHandler(req, deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});

test('transcribeHandler: missing privacy consent returns 403 before the transcriber is called', async () => {
  const { deps, token } = authedDeps();
  deps.privacy = createInMemoryPrivacyStore(emptyPrivacyExport(deps.clock.now()), deps.clock, 'missing');
  const transcriber = createFakeTranscriber([
    { ok: true, value: { ...okTranscript('I want a croissant please'), noSpeechProb: 0.01 } },
  ]);
  deps.transcriber = transcriber;
  const req = makeMultipartRequest(
    URL,
    { purpose: 'chat', audio: { bytes: new Uint8Array([1]), mimeType: 'audio/webm', filename: 'a.webm' } },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const res = await transcribeHandler(req, deps);
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.error.code, 'forbidden');
  assert.equal(transcriber.calls.length, 0);
});

test('transcribeHandler: a failing consent check fails closed (403, not open), transcriber never called', async () => {
  const { deps, token } = authedDeps();
  deps.privacy = createInMemoryPrivacyStore(emptyPrivacyExport(deps.clock.now()), deps.clock, 'error');
  const transcriber = createFakeTranscriber([
    { ok: true, value: { ...okTranscript('I want a croissant please'), noSpeechProb: 0.01 } },
  ]);
  deps.transcriber = transcriber;
  const req = makeMultipartRequest(
    URL,
    { purpose: 'chat', audio: { bytes: new Uint8Array([1]), mimeType: 'audio/webm', filename: 'a.webm' } },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const res = await transcribeHandler(req, deps);
  assert.equal(res.status, 403);
  assert.equal(transcriber.calls.length, 0);
});

test('transcribeHandler: a foreign origin is rejected with 403 before touching the audio', async () => {
  const { deps, token } = authedDeps();
  const req = makeMultipartRequest(
    URL,
    { purpose: 'chat', audio: { bytes: new Uint8Array([1]), mimeType: 'audio/webm', filename: 'a.webm' } },
    { origin: 'https://evil.example.com', authorization: `Bearer ${token}` },
  );
  const res = await transcribeHandler(req, deps);
  assert.equal(res.status, 403);
});
