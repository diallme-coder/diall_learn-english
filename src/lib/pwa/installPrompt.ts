// src/lib/pwa/installPrompt.ts: pure install-context classifier. The
// component (InstallPrompt.tsx, this unit) reads the real environment
// (matchMedia, navigator.standalone, user agent, the captured
// beforeinstallprompt event) and passes it in here, so this stays
// DOM-free and testable with node:test.

export const INSTALL_CONTEXTS = [
  'installed',
  'promptable',
  'ios_safari_manual',
  'unsupported',
] as const;
export type InstallContext = (typeof INSTALL_CONTEXTS)[number];

export interface InstallEnvironment {
  /** `display-mode: standalone` matched, or `navigator.standalone` on iOS. */
  isStandalone: boolean;
  /** User agent indicates an iOS device (iPhone/iPad/iPod, or iPadOS desktop UA). */
  isIos: boolean;
  /** User agent indicates Safari (the only iOS browser with "Add to Home Screen"). */
  isSafari: boolean;
  /** A `beforeinstallprompt` event was captured and can be shown. */
  canPrompt: boolean;
}

/**
 * Classifies how (or whether) to offer installing the PWA.
 * - `installed`: already running standalone; no prompt needed.
 * - `promptable`: the browser offers its own install flow (Android Chrome/Edge).
 * - `ios_safari_manual`: iOS Safari never fires `beforeinstallprompt`; show
 *   "Partager > Sur l'écran d'accueil" instructions instead.
 * - `unsupported`: no known install path (e.g. a non-Safari iOS browser).
 */
export function detectInstallContext(env: InstallEnvironment): InstallContext {
  if (env.isStandalone) return 'installed';
  if (env.canPrompt) return 'promptable';
  if (env.isIos && env.isSafari) return 'ios_safari_manual';
  return 'unsupported';
}
