import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasEnglishVoice, pickTtsStrategy } from './tts.ts';

test('pickTtsStrategy: catalog hit always wins (server)', () => {
  assert.strictEqual(pickTtsStrategy({ catalogHit: true, hasEnglishVoice: true }), 'server');
  assert.strictEqual(pickTtsStrategy({ catalogHit: true, hasEnglishVoice: false }), 'server');
});

test('pickTtsStrategy: no catalog hit but an English voice exists -> speechSynthesis', () => {
  assert.strictEqual(pickTtsStrategy({ catalogHit: false, hasEnglishVoice: true }), 'speechSynthesis');
});

test('pickTtsStrategy: no catalog hit and no English voice -> text-only', () => {
  assert.strictEqual(pickTtsStrategy({ catalogHit: false, hasEnglishVoice: false }), 'text-only');
});

test('hasEnglishVoice detects an en-* voice case-insensitively', () => {
  assert.strictEqual(hasEnglishVoice([{ lang: 'fr-FR' }, { lang: 'EN-us' }]), true);
  assert.strictEqual(hasEnglishVoice([{ lang: 'fr-FR' }, { lang: 'de-DE' }]), false);
  assert.strictEqual(hasEnglishVoice([]), false);
});
