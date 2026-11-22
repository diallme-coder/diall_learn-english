import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getTranscribeLanguageHint, getTranscribePrompt } from './transcribe.ts';
import { TRANSCRIBE_PURPOSES } from '../types.ts';

test('getTranscribePrompt: only "chat" gets a prompt; the rest get none', () => {
  for (const purpose of TRANSCRIBE_PURPOSES) {
    const prompt = getTranscribePrompt(purpose);
    if (purpose === 'chat') {
      assert.notEqual(prompt, undefined);
    } else {
      assert.equal(prompt, undefined);
    }
  }
});

test('getTranscribeLanguageHint: "en" is forced for shadowing, pronunciation and placement', () => {
  assert.equal(getTranscribeLanguageHint('shadowing'), 'en');
  assert.equal(getTranscribeLanguageHint('pronunciation'), 'en');
  assert.equal(getTranscribeLanguageHint('placement'), 'en');
});

test('getTranscribeLanguageHint: "chat" gets no forced hint (auto language)', () => {
  assert.equal(getTranscribeLanguageHint('chat'), undefined);
});
