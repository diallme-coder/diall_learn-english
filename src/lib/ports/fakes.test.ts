import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFakeAuth,
  createFakeChatModel,
  createFakeRateLimiter,
  createFakeSynthesizer,
  createFakeTranscriber,
  createFixedClock,
  createInMemoryPrivacyStore,
  createInMemoryProgressStore,
  createMemoryTtsCache,
} from './fakes.ts';
import type { ProgressSnapshot, PrivacyExport } from '../types.ts';

test('createFixedClock: now() is stable until advanced', () => {
  const clock = createFixedClock(1000);
  assert.equal(clock.now(), 1000);
  clock.advance(500);
  assert.equal(clock.now(), 1500);
  clock.set(42);
  assert.equal(clock.now(), 42);
});

test('createFakeTranscriber: returns scripted results in sequence and records calls', async () => {
  const transcriber = createFakeTranscriber([
    { ok: true, value: { text: 'hello', language: 'en', words: [], durationSec: 1, noSpeechProb: 0.1 } },
    { ok: false, error: { code: 'internal', message: 'boom' } },
  ]);
  const r1 = await transcriber.transcribe(
    { bytes: new Uint8Array(0), mimeType: 'audio/webm', filename: 'a.webm' },
    { purpose: 'chat' },
  );
  assert.equal(r1.ok, true);
  const r2 = await transcriber.transcribe(
    { bytes: new Uint8Array(0), mimeType: 'audio/webm', filename: 'b.webm' },
    { purpose: 'shadowing' },
  );
  assert.equal(r2.ok, false);
  assert.equal(transcriber.calls.length, 2);
  assert.equal(transcriber.calls[1]?.opts.purpose, 'shadowing');
});

test('createFakeChatModel: records the request and returns scripted completions', async () => {
  const chat = createFakeChatModel([{ ok: true, value: 'hello there' }]);
  const result = await chat.complete({ system: 'sys', messages: [], maxTokens: 10 });
  assert.equal(result.ok, true);
  assert.equal(chat.calls.length, 1);
});

test('createFakeSynthesizer: default returns bytes', async () => {
  const synth = createFakeSynthesizer();
  const result = await synth.synthesize('hello', { voice: 'alloy' });
  assert.equal(result.ok, true);
  assert.equal(synth.calls[0]?.text, 'hello');
});

test('createMemoryTtsCache: get/set round-trip', async () => {
  const cache = createMemoryTtsCache();
  assert.equal(await cache.get('k1'), null);
  await cache.set('k1', new Uint8Array([9, 9]));
  const value = await cache.get('k1');
  assert.deepEqual(Array.from(value ?? []), [9, 9]);
});

test('createFakeAuth: resolves a known token and rejects unknown/missing ones', async () => {
  const auth = createFakeAuth({ tok1: { userId: 'u1', accessToken: 'tok1' } });
  const ok = await auth.verify('Bearer tok1', 0);
  assert.equal(ok.ok, true);
  const missing = await auth.verify(null, 0);
  assert.equal(missing.ok, false);
  const unknown = await auth.verify('Bearer nope', 0);
  assert.equal(unknown.ok, false);
});

test('createInMemoryProgressStore: record() captures events keyed by userId', async () => {
  const snapshot: ProgressSnapshot = {
    profile: { level: null, nativeLang: 'fr', ageBand: null, consent: null, settings: {
      captionsOn: true, playbackRate: 0.85, textAnswerMode: false, sideCardAutoCollapse: true, silenceAnnouncementsWhileRecording: true,
    } },
    vocabulary: [], weakPhonemes: [], recentSessions: [], srsCards: [], streakDays: 0,
  };
  const store = createInMemoryProgressStore(snapshot);
  const got = await store.getSnapshot({ userId: 'u1', accessToken: 't' }, { tzOffsetMin: 0 });
  assert.equal(got.ok, true);
  await store.record({ userId: 'u1', accessToken: 't' }, { eventId: 'e1', type: 'level_set', level: 'A1' });
  assert.equal(store.recordedEvents.length, 1);
  assert.equal(store.recordedEvents[0]?.userId, 'u1');
});

test('createInMemoryPrivacyStore: acceptConsent, exportAll, deleteAccount', async () => {
  const clock = createFixedClock(100);
  const exportValue: PrivacyExport = {
    exportedAt: 100, profile: { level: null, nativeLang: 'fr', ageBand: null, consent: null, settings: {
      captionsOn: true, playbackRate: 1, textAnswerMode: false, sideCardAutoCollapse: true, silenceAnnouncementsWhileRecording: true,
    } },
    sessions: [], vocabulary: [], weakPhonemes: [], drillAttempts: [], srsCards: [], consents: [],
  };
  const store = createInMemoryPrivacyStore(exportValue, clock);
  await store.acceptConsent({ userId: 'u1', accessToken: 't' }, '2026-11-21', '18+');
  assert.equal(store.consents.length, 1);
  const exported = await store.exportAll({ userId: 'u1', accessToken: 't' });
  assert.equal(exported.ok, true);
  await store.deleteAccount({ userId: 'u1', accessToken: 't' });
  assert.deepEqual(store.deletedUserIds, ['u1']);
});

test('createFakeRateLimiter: "allow" and "deny" policies', () => {
  const allow = createFakeRateLimiter('allow');
  assert.equal(allow.take('user', 'u1', 'chat', 0).allowed, true);
  const deny = createFakeRateLimiter('deny');
  assert.equal(deny.take('user', 'u1', 'chat', 0).allowed, false);
});
