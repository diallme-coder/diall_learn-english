import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nudgeForElapsed, reduceSession, SILENCE_NUDGE_MS } from './sessionMachine.ts';

test('silence nudges fire at 6s/12s/25s boundaries, and not before', () => {
  assert.strictEqual(nudgeForElapsed(0), null);
  assert.strictEqual(nudgeForElapsed(SILENCE_NUDGE_MS.gentle - 1), null);
  assert.strictEqual(nudgeForElapsed(SILENCE_NUDGE_MS.gentle), 'gentle');
  assert.strictEqual(nudgeForElapsed(SILENCE_NUDGE_MS.gentle + 1), 'gentle');

  assert.strictEqual(nudgeForElapsed(SILENCE_NUDGE_MS.help - 1), 'gentle');
  assert.strictEqual(nudgeForElapsed(SILENCE_NUDGE_MS.help), 'help');

  assert.strictEqual(nudgeForElapsed(SILENCE_NUDGE_MS.exit - 1), 'help');
  assert.strictEqual(nudgeForElapsed(SILENCE_NUDGE_MS.exit), 'exit');
  assert.strictEqual(nudgeForElapsed(SILENCE_NUDGE_MS.exit + 10_000), 'exit');
});

test('reduceSession reports the nudge only while still listening', () => {
  const listening = reduceSession({ state: 'listening', mode: 'push_to_talk', elapsedMs: 7000, events: [] });
  assert.strictEqual(listening.state, 'listening');
  assert.strictEqual(listening.nudge, 'gentle');

  const idle = reduceSession({ state: 'idle', mode: 'push_to_talk', elapsedMs: 7000, events: [] });
  assert.strictEqual(idle.nudge, undefined);
});

test('push-to-talk: explicit start/stop drive the turn', () => {
  let result = reduceSession({ state: 'idle', mode: 'push_to_talk', elapsedMs: 0, events: [{ type: 'ptt_start' }] });
  assert.strictEqual(result.state, 'listening');

  result = reduceSession({ state: 'listening', mode: 'push_to_talk', elapsedMs: 0, events: [{ type: 'ptt_stop' }] });
  assert.strictEqual(result.state, 'thinking');

  // VAD events are ignored in push-to-talk mode.
  result = reduceSession({ state: 'idle', mode: 'push_to_talk', elapsedMs: 0, events: [{ type: 'vad_speech_start' }] });
  assert.strictEqual(result.state, 'idle');
});

test('hands-free: VAD start/stop drive the turn, explicit events are ignored', () => {
  let result = reduceSession({ state: 'idle', mode: 'hands_free', elapsedMs: 0, events: [{ type: 'vad_speech_start' }] });
  assert.strictEqual(result.state, 'listening');

  result = reduceSession({ state: 'listening', mode: 'hands_free', elapsedMs: 0, events: [{ type: 'vad_speech_end' }] });
  assert.strictEqual(result.state, 'thinking');

  result = reduceSession({ state: 'idle', mode: 'hands_free', elapsedMs: 0, events: [{ type: 'ptt_start' }] });
  assert.strictEqual(result.state, 'idle');
});

test('full turn: listening -> thinking -> speaking -> idle', () => {
  const result = reduceSession({
    state: 'listening',
    mode: 'push_to_talk',
    elapsedMs: 0,
    events: [{ type: 'ptt_stop' }, { type: 'thinking_done' }, { type: 'speaking_done' }],
  });
  assert.strictEqual(result.state, 'idle');
});

test('offline/denied/error are reachable from any state and recoverable via retry/went_online', () => {
  assert.strictEqual(
    reduceSession({ state: 'listening', mode: 'push_to_talk', elapsedMs: 0, events: [{ type: 'went_offline' }] }).state,
    'offline',
  );
  assert.strictEqual(
    reduceSession({ state: 'offline', mode: 'push_to_talk', elapsedMs: 0, events: [{ type: 'went_online' }] }).state,
    'idle',
  );
  assert.strictEqual(
    reduceSession({ state: 'idle', mode: 'push_to_talk', elapsedMs: 0, events: [{ type: 'mic_denied' }] }).state,
    'denied',
  );
  assert.strictEqual(
    reduceSession({ state: 'denied', mode: 'push_to_talk', elapsedMs: 0, events: [{ type: 'retry' }] }).state,
    'idle',
  );
});
