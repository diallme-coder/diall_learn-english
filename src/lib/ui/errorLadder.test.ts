import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getErrorLadder, rungForAttempt, errorLadderMessage } from './errorLadder.ts';

test('each context has an escalating 3-rung ladder ending in a fallback', () => {
  for (const context of ['mic-denied', 'network-offline', 'upstream-timeout', 'upstream-error', 'rate-limited', 'no_speech'] as const) {
    const ladder = getErrorLadder(context);
    assert.strictEqual(ladder.length, 3);
    assert.deepStrictEqual(ladder.map((r) => r.rung), [1, 2, 3]);
    assert.strictEqual(ladder[2]?.action, 'text-mode');
  }
});

test('rungForAttempt clamps to the last rung past 3 failures', () => {
  assert.strictEqual(rungForAttempt('upstream-error', 1).rung, 1);
  assert.strictEqual(rungForAttempt('upstream-error', 2).rung, 2);
  assert.strictEqual(rungForAttempt('upstream-error', 3).rung, 3);
  assert.strictEqual(rungForAttempt('upstream-error', 10).rung, 3);
  assert.strictEqual(rungForAttempt('upstream-error', 0).rung, 1);
});

test('no_speech advances the ladder like other failures', () => {
  assert.strictEqual(rungForAttempt('no_speech', 1).messageKey, 'speechLadder1');
  assert.strictEqual(rungForAttempt('no_speech', 2).messageKey, 'speechLadder2');
  assert.strictEqual(rungForAttempt('no_speech', 3).messageKey, 'speechLadder3');
});

test('errorLadderMessage resolves to real copy text', () => {
  const message = errorLadderMessage('mic-denied', 1, 'fr');
  assert.ok(message.length > 0);
});
