import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  micPermissionReducer,
  mapGetUserMediaError,
  KNOWN_GET_USER_MEDIA_ERRORS,
  MIC_PERMISSION_STATES,
} from './micPermission.ts';
import type { MicPermissionState } from './micPermission.ts';
import { MIC_COPY } from './copy.ts';

test('every MIC_PERMISSION_STATES entry has copy', () => {
  for (const state of MIC_PERMISSION_STATES) {
    assert.ok(MIC_COPY[state], `missing copy for state ${state}`);
    assert.ok(MIC_COPY[state].titleFr.length > 0);
  }
});

test('mapGetUserMediaError: every known error name maps to a valid state', () => {
  for (const name of KNOWN_GET_USER_MEDIA_ERRORS) {
    const mapped = mapGetUserMediaError(name);
    assert.ok((MIC_PERMISSION_STATES as readonly string[]).includes(mapped));
  }
});

test('mapGetUserMediaError: specific mappings', () => {
  assert.strictEqual(mapGetUserMediaError('NotAllowedError'), 'denied');
  assert.strictEqual(mapGetUserMediaError('NotFoundError'), 'unavailable');
  assert.strictEqual(mapGetUserMediaError('NotReadableError'), 'in_use');
  assert.strictEqual(mapGetUserMediaError('SecurityError'), 'insecure');
  assert.strictEqual(mapGetUserMediaError('OverconstrainedError'), 'unavailable');
});

test('mapGetUserMediaError: unknown error name fails safe to unavailable', () => {
  assert.strictEqual(mapGetUserMediaError('SomeWeirdError'), 'unavailable');
  assert.strictEqual(mapGetUserMediaError(''), 'unavailable');
});

test('reducer: insecure_context is terminal except for reset', () => {
  const insecure = micPermissionReducer('unknown', { type: 'insecure_context' });
  assert.strictEqual(insecure, 'insecure');
  assert.strictEqual(
    micPermissionReducer(insecure, { type: 'request_start' }),
    'insecure',
  );
  assert.strictEqual(
    micPermissionReducer(insecure, { type: 'permissions_api_result', status: 'granted' }),
    'insecure',
  );
  assert.strictEqual(micPermissionReducer(insecure, { type: 'reset' }), 'unknown');
});

test('reducer: permissions_api_result maps status to state', () => {
  assert.strictEqual(
    micPermissionReducer('unknown', { type: 'permissions_api_result', status: 'granted' }),
    'granted',
  );
  assert.strictEqual(
    micPermissionReducer('unknown', { type: 'permissions_api_result', status: 'denied' }),
    'denied',
  );
  assert.strictEqual(
    micPermissionReducer('unknown', { type: 'permissions_api_result', status: 'prompt' }),
    'prompt',
  );
});

test('reducer: request lifecycle', () => {
  assert.strictEqual(micPermissionReducer('prompt', { type: 'request_start' }), 'requesting');
  assert.strictEqual(
    micPermissionReducer('requesting', { type: 'request_success' }),
    'granted',
  );
  assert.strictEqual(
    micPermissionReducer('requesting', { type: 'request_error', errorName: 'NotAllowedError' }),
    'denied',
  );
});

test('reducer: reset always returns to unknown', () => {
  for (const state of MIC_PERMISSION_STATES) {
    assert.strictEqual(micPermissionReducer(state, { type: 'reset' }), 'unknown');
  }
});

test('reducer: covers every state as a starting point for request_start', () => {
  const results = new Map<MicPermissionState, MicPermissionState>();
  for (const state of MIC_PERMISSION_STATES) {
    results.set(state, micPermissionReducer(state, { type: 'request_start' }));
  }
  assert.strictEqual(results.get('prompt'), 'requesting');
  assert.strictEqual(results.get('denied'), 'requesting');
  assert.strictEqual(results.get('insecure'), 'insecure');
});
