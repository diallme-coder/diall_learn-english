import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDebateFeedback } from './feedback.ts';

const VALID_SAMPLE = {
  items: [
    {
      original: "I think that remote work is more good for the families.",
      native: 'Remote work is better for families.',
      explanationFr: '« more good » devient « better » ; pas d\'article devant « families ».',
      tags: ['grammar', 'word_choice'],
    },
  ],
  idiomsUsed: ['figure_out'],
  idiomsToTry: ['put_up_with', 'run_into'],
  summaryFr: 'Bonne argumentation, continue à travailler les comparatifs.',
};

test('parses a valid sample LLM JSON string', () => {
  const result = parseDebateFeedback(JSON.stringify(VALID_SAMPLE));
  assert.strictEqual(result.ok, true);
  if (result.ok) {
    assert.strictEqual(result.value.items.length, 1);
    assert.strictEqual(result.value.items[0]!.native, 'Remote work is better for families.');
    assert.deepStrictEqual(result.value.idiomsUsed, ['figure_out']);
    assert.deepStrictEqual(result.value.codeSwitchCards, []);
  }
});

test('tolerates a ```json code fence around the payload', () => {
  const fenced = '```json\n' + JSON.stringify(VALID_SAMPLE) + '\n```';
  const result = parseDebateFeedback(fenced);
  assert.strictEqual(result.ok, true);
});

test('tolerates a missing leading brace (Anthropic JSON-mode prefill)', () => {
  const full = JSON.stringify(VALID_SAMPLE);
  const withoutBrace = full.slice(1); // drop the leading '{'
  const result = parseDebateFeedback(withoutBrace);
  assert.strictEqual(result.ok, true);
});

test('returns ok:false with upstream_error on garbage input, never throws', () => {
  assert.doesNotThrow(() => parseDebateFeedback('not json at all {{{'));
  const result = parseDebateFeedback('not json at all {{{');
  assert.strictEqual(result.ok, false);
  if (!result.ok) assert.strictEqual(result.error.code, 'upstream_error');
});

test('rejects a missing summaryFr', () => {
  const { summaryFr, ...rest } = VALID_SAMPLE;
  const result = parseDebateFeedback(JSON.stringify(rest));
  assert.strictEqual(result.ok, false);
  if (!result.ok) assert.strictEqual(result.error.code, 'upstream_error');
});

test('rejects an unknown feedback tag', () => {
  const bad = { ...VALID_SAMPLE, items: [{ ...VALID_SAMPLE.items[0], tags: ['not_a_real_tag'] }] };
  const result = parseDebateFeedback(JSON.stringify(bad));
  assert.strictEqual(result.ok, false);
});

test('rejects more than 8 items', () => {
  const tooMany = { ...VALID_SAMPLE, items: Array.from({ length: 9 }, () => VALID_SAMPLE.items[0]) };
  const result = parseDebateFeedback(JSON.stringify(tooMany));
  assert.strictEqual(result.ok, false);
});

test('rejects a string field over 400 chars', () => {
  const bad = { ...VALID_SAMPLE, summaryFr: 'a'.repeat(401) };
  const result = parseDebateFeedback(JSON.stringify(bad));
  assert.strictEqual(result.ok, false);
});
