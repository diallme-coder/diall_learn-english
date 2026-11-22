// src/lib/pwa/micPermission.ts: mic-permission state machine (design 04 §7
// system ladder; design 05 §7 pre-prompt explainer + recovery).
// No DOM access here: the component (H2) calls getUserMedia/Permissions API
// and feeds results in as actions, so this stays testable with node:test.

import { MIC_PERMISSION_STATES } from './copy.ts';
import type { MicPermissionState } from './copy.ts';

export { MIC_PERMISSION_STATES };
export type { MicPermissionState };

export type PermissionsApiStatus = 'granted' | 'denied' | 'prompt';

export type MicPermissionAction =
  | { type: 'insecure_context' }
  | { type: 'permissions_api_result'; status: PermissionsApiStatus }
  | { type: 'request_start' }
  | { type: 'request_success' }
  | { type: 'request_error'; errorName: string }
  | { type: 'reset' };

// The getUserMedia error names this app recognises (design A §7).
export const KNOWN_GET_USER_MEDIA_ERRORS = [
  'NotAllowedError',
  'NotFoundError',
  'NotReadableError',
  'SecurityError',
  'OverconstrainedError',
] as const;

/** Maps a getUserMedia/MediaDevices error name to the state it leads to. */
export function mapGetUserMediaError(errorName: string): MicPermissionState {
  switch (errorName) {
    case 'NotAllowedError':
      return 'denied';
    case 'NotFoundError':
      return 'unavailable';
    case 'NotReadableError':
      return 'in_use';
    case 'SecurityError':
      return 'insecure';
    case 'OverconstrainedError':
      return 'unavailable';
    default:
      // Unknown error names fail safe into the generic "can't find it"
      // state, which offers retry and the text-mode fallback.
      return 'unavailable';
  }
}

function fromPermissionsApiStatus(status: PermissionsApiStatus): MicPermissionState {
  switch (status) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'prompt':
      return 'prompt';
  }
}

/** Pure reducer driving the mic-permission UI (MicPermissionGate, H2). */
export function micPermissionReducer(
  state: MicPermissionState,
  action: MicPermissionAction,
): MicPermissionState {
  // An insecure context is terminal: no amount of retrying changes it.
  if (state === 'insecure' && action.type !== 'reset') return state;

  switch (action.type) {
    case 'insecure_context':
      return 'insecure';
    case 'permissions_api_result':
      return fromPermissionsApiStatus(action.status);
    case 'request_start':
      return 'requesting';
    case 'request_success':
      return 'granted';
    case 'request_error':
      return mapGetUserMediaError(action.errorName);
    case 'reset':
      return 'unknown';
  }
}
