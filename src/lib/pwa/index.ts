// src/lib/pwa/index.ts: public API of src/lib/pwa (plan §6).
export { micPermissionReducer, mapGetUserMediaError, MIC_PERMISSION_STATES } from './micPermission.ts';
export type { MicPermissionState, MicPermissionAction, PermissionsApiStatus } from './micPermission.ts';
export { detectInstallContext, INSTALL_CONTEXTS } from './installPrompt.ts';
export type { InstallContext, InstallEnvironment } from './installPrompt.ts';
export { MIC_COPY, MIC_DENIED_RECOVERY_STEPS_FR, MIC_TEXT_MODE_OFFER_FR } from './copy.ts';
export type { MicCopyEntry } from './copy.ts';
