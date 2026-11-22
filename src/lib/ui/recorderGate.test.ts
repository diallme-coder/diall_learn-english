import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRecorderGate, SILENT_LEVEL_THRESHOLD } from './recorderGate.ts';
import { LIMITS } from '../types.ts';

test('accepts a recording at/above minRecordingSec with a healthy level', () => {
  const atMin = evaluateRecorderGate({ durationMs: LIMITS.minRecordingSec * 1000, rmsLevel: 0.2 });
  assert.strictEqual(atMin.accepted, true);

  const above = evaluateRecorderGate({ durationMs: (LIMITS.minRecordingSec + 1) * 1000, rmsLevel: 0.2 });
  assert.strictEqual(above.accepted, true);
});

test('rejects as too_short below minRecordingSec', () => {
  const result = evaluateRecorderGate({ durationMs: LIMITS.minRecordingSec * 1000 - 1, rmsLevel: 0.2 });
  assert.strictEqual(result.accepted, false);
  assert.strictEqual(result.reason, 'too_short');
});

test('rejects as silent when long enough but below the level threshold', () => {
  const result = evaluateRecorderGate({
    durationMs: (LIMITS.minRecordingSec + 1) * 1000,
    rmsLevel: SILENT_LEVEL_THRESHOLD / 2,
  });
  assert.strictEqual(result.accepted, false);
  assert.strictEqual(result.reason, 'silent');
});

test('accepts when no level is provided at all (duration-only check)', () => {
  const result = evaluateRecorderGate({ durationMs: (LIMITS.minRecordingSec + 1) * 1000 });
  assert.strictEqual(result.accepted, true);
});

test('peakLevel is accepted as an alternative to rmsLevel', () => {
  const result = evaluateRecorderGate({
    durationMs: (LIMITS.minRecordingSec + 1) * 1000,
    peakLevel: SILENT_LEVEL_THRESHOLD / 2,
  });
  assert.strictEqual(result.reason, 'silent');
});
