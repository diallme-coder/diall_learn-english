import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectInstallContext } from './installPrompt.ts';
import type { InstallEnvironment } from './installPrompt.ts';

function env(overrides: Partial<InstallEnvironment>): InstallEnvironment {
  return {
    isStandalone: false,
    isIos: false,
    isSafari: false,
    canPrompt: false,
    ...overrides,
  };
}

test('already installed (standalone) takes priority over everything else', () => {
  assert.strictEqual(
    detectInstallContext(env({ isStandalone: true, canPrompt: true, isIos: true, isSafari: true })),
    'installed',
  );
});

test('Android Chrome style: beforeinstallprompt captured', () => {
  assert.strictEqual(detectInstallContext(env({ canPrompt: true })), 'promptable');
});

test('iOS Safari: no beforeinstallprompt, manual instructions', () => {
  assert.strictEqual(
    detectInstallContext(env({ isIos: true, isSafari: true })),
    'ios_safari_manual',
  );
});

test('iOS non-Safari browser: unsupported', () => {
  assert.strictEqual(detectInstallContext(env({ isIos: true, isSafari: false })), 'unsupported');
});

test('desktop browser with no install support: unsupported', () => {
  assert.strictEqual(detectInstallContext(env({})), 'unsupported');
});
