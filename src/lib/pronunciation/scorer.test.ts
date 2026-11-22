import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PronunciationScoreRequest, Transcript } from '../types.ts';
import { scorePronunciation } from './scorer.ts';
import { isSensitiveWord } from './sensitive.ts';

function loadFixture(name: string): PronunciationScoreRequest {
  const path = fileURLToPath(new URL(`./fixtures/synthetic/${name}`, import.meta.url));
  const raw = JSON.parse(readFileSync(path, 'utf8')) as {
    referenceText: string;
    transcript: Transcript;
  };
  return { referenceText: raw.referenceText, transcript: raw.transcript };
}

// --- Acceptance: isolated minimal-pair drill -> 'error' -------------------

test('isolated "think" heard as "sink" -> error with th_as_s', () => {
  const report = scorePronunciation(loadFixture('think_sink_isolated.json'));
  assert.strictEqual(report.words.length, 1);
  const word = report.words[0];
  assert.ok(word);
  assert.strictEqual(word.status, 'error');
  assert.deepStrictEqual(word.trapIds, ['th_as_s']);
});

// --- Acceptance: same confusion in a sentence -> 'warn', never 'error' ----

test('"I think so" / "I sink so" -> warn with th_as_s, not error', () => {
  const report = scorePronunciation(loadFixture('think_so_sentence.json'));
  const thinkWord = report.words.find((w) => w.expected === 'think');
  assert.ok(thinkWord);
  assert.strictEqual(thinkWord.status, 'warn');
  assert.deepStrictEqual(thinkWord.trapIds, ['th_as_s']);
  assert.notStrictEqual(thinkWord.status, 'error');
});

// --- Acceptance: two confusions in one sentence; tip priority th > vowel --

test('"this is my ship" / "zis is my sheep" -> dh_as_z and ih_vs_iy warns; the tip is on "zis"', () => {
  const report = scorePronunciation(loadFixture('ship_sheep_sentence.json'));
  const thisWord = report.words.find((w) => w.expected === 'this');
  const shipWord = report.words.find((w) => w.expected === 'ship');
  assert.ok(thisWord && shipWord);
  assert.strictEqual(thisWord.status, 'warn');
  assert.deepStrictEqual(thisWord.trapIds, ['dh_as_z']);
  assert.strictEqual(thisWord.heard, 'zis');
  assert.strictEqual(shipWord.status, 'warn');
  assert.deepStrictEqual(shipWord.trapIds, ['ih_vs_iy']);

  // th > h > vowel: dh_as_z (category 'th') outranks ih_vs_iy (category 'vowel_length').
  assert.ok(report.primaryTip);
  assert.strictEqual(report.primaryTip?.trapId, 'dh_as_z');
  assert.strictEqual(report.primaryTip?.wordIndex, thisWord.index);
});

// --- Invariant (a): confidence undefined -------------------------------

test('(a) a word with confidence === undefined is never unsure and scores <= 80', () => {
  const report = scorePronunciation(loadFixture('undefined_confidence.json'));
  const morning = report.words.find((w) => w.expected === 'morning');
  assert.ok(morning);
  assert.notStrictEqual(morning.status, 'unsure');
  assert.ok(morning.score <= 80);
});

// --- Invariant (b)/(c): isolated vs sentence error ceiling ---------------

test('(b) a 1-2 word reference can produce "error"', () => {
  const report = scorePronunciation(loadFixture('think_sink_isolated.json'));
  assert.ok(report.words.some((w) => w.status === 'error'));
});

test('(c) a 5+ word sentence reference with the same substitution produces "warn", never "error"', () => {
  const report = scorePronunciation({
    referenceText: 'I really think that is true',
    transcript: {
      text: 'I really sink that is true',
      language: 'en',
      durationSec: 2,
      words: [
        { text: 'I', startSec: 0, endSec: 0.2, confidence: 0.95 },
        { text: 'really', startSec: 0.2, endSec: 0.6, confidence: 0.9 },
        { text: 'sink', startSec: 0.6, endSec: 1.0, confidence: 0.8 },
        { text: 'that', startSec: 1.0, endSec: 1.2, confidence: 0.9 },
        { text: 'is', startSec: 1.2, endSec: 1.3, confidence: 0.95 },
        { text: 'true', startSec: 1.3, endSec: 1.6, confidence: 0.9 },
      ],
    },
  });
  const think = report.words.find((w) => w.expected === 'think');
  assert.ok(think);
  assert.strictEqual(think.status, 'warn');
  assert.notStrictEqual(think.status, 'error');
});

// --- Invariant (d): heavy deletion ----------------------------------------

test('(d) more than 60% deletions -> overall === null and every word is unsure', () => {
  const report = scorePronunciation(loadFixture('heavy_deletion.json'));
  assert.strictEqual(report.overall, null);
  assert.strictEqual(report.primaryTip, null);
  assert.ok(report.words.length > 0);
  for (const w of report.words) assert.strictEqual(w.status, 'unsure');
});

// --- Invariant (e): sensitive heard token ---------------------------------

test('(e) a sensitive heard token is never echoed: WordScore.heard === null, tip still shown', () => {
  const report = scorePronunciation(loadFixture('beach_sensitive.json'));
  assert.strictEqual(report.words.length, 1);
  const word = report.words[0];
  assert.ok(word);
  assert.strictEqual(word.heard, null);
  assert.ok(word.tipFr && word.tipFr.length > 0);
  assert.ok(!word.tipFr?.toLowerCase().includes('bitch'));
});

// --- Invariant (f): practiceWords never contain the sensitive word --------

test('(f) no trap practiceWords list contains a sensitive confusedWith string', async () => {
  const { TRAPS } = await import('./traps.ts');
  for (const trap of TRAPS) {
    for (const word of trap.practiceWords) {
      assert.ok(!isSensitiveWord(word), `${trap.id}.practiceWords contains "${word}"`);
    }
  }
});

// --- Invariant (g): charStart/charEnd round-trip --------------------------

test('(g) charStart/charEnd slice referenceText back to the original word', () => {
  const referenceText = "I think this is my ship, don't worry.";
  const report = scorePronunciation({
    referenceText,
    transcript: {
      text: referenceText,
      language: 'en',
      durationSec: 2,
      words: referenceText
        .split(/\s+/)
        .map((w, i) => ({ text: w.replace(/[^a-zA-Z']/g, ''), startSec: i, endSec: i + 0.5, confidence: 0.9 })),
    },
  });
  for (const word of report.words) {
    assert.strictEqual(referenceText.slice(word.charStart, word.charEnd), word.expected);
  }
});

// --- Extra: stress_misplaced / weak_forms are never emitted ---------------

test('the scorer never returns stress_misplaced or weak_forms across all fixtures', () => {
  const fixtures = [
    'think_sink_isolated.json',
    'think_so_sentence.json',
    'ship_sheep_sentence.json',
    'heavy_deletion.json',
    'undefined_confidence.json',
    'beach_sensitive.json',
  ];
  for (const name of fixtures) {
    const report = scorePronunciation(loadFixture(name));
    for (const w of report.words) {
      assert.ok(!w.trapIds.includes('stress_misplaced'), `${name} flagged stress_misplaced`);
      assert.ok(!w.trapIds.includes('weak_forms'), `${name} flagged weak_forms`);
    }
  }
});

test('trapCounts only ever contains scoreable (non stress_rhythm) traps', () => {
  const report = scorePronunciation(loadFixture('ship_sheep_sentence.json'));
  for (const count of report.trapCounts) {
    assert.ok(count.trapId !== 'stress_misplaced' && count.trapId !== 'weak_forms');
  }
});

test('a clean, correctly-heard sentence scores ok overall with no traps', () => {
  const referenceText = 'good morning everyone';
  const report = scorePronunciation({
    referenceText,
    transcript: {
      text: referenceText,
      language: 'en',
      durationSec: 1.5,
      words: [
        { text: 'good', startSec: 0, endSec: 0.4, confidence: 0.98 },
        { text: 'morning', startSec: 0.4, endSec: 0.9, confidence: 0.97 },
        { text: 'everyone', startSec: 0.9, endSec: 1.5, confidence: 0.96 },
      ],
    },
  });
  assert.ok(report.overall !== null && report.overall >= 90);
  assert.strictEqual(report.primaryTip, null);
  for (const w of report.words) {
    assert.strictEqual(w.status, 'ok');
    assert.deepStrictEqual(w.trapIds, []);
  }
});
