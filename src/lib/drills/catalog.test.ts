import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRILL_ITEMS, getDrill } from './catalog.ts';

test('catalog has at least 22 unique ids', () => {
  assert.ok(DRILL_ITEMS.length >= 22);
  const ids = new Set(DRILL_ITEMS.map((i) => i.id));
  assert.equal(ids.size, DRILL_ITEMS.length);
});

test('every item has >= 4 accepted English forms and at least one trap pattern', () => {
  for (const item of DRILL_ITEMS) {
    assert.ok(item.acceptedEn.length >= 4, `${item.id} needs >= 4 acceptedEn`);
    assert.ok(item.trapPatterns.length >= 1, `${item.id} needs >= 1 trapPattern`);
    assert.ok(item.explanationFr.length > 0, `${item.id} needs a French explanation`);
    assert.ok(item.tags.length > 0, `${item.id} needs tags`);
    // the literal trap itself must never appear as an accepted answer
    assert.ok(!item.acceptedEn.includes(item.literalTrapEn), `${item.id} must not accept its own trap`);
  }
});

test('the three brief-named examples are present with their exact forms', () => {
  const age25 = getDrill('age-25');
  assert.ok(age25);
  assert.equal(age25?.promptFr, "J'ai 25 ans");
  assert.equal(age25?.literalTrapEn, 'I have 25 years');
  assert.ok(age25?.acceptedEn.includes('I am 25 years old'));

  const agree = getDrill('agree');
  assert.ok(agree);
  assert.equal(agree?.promptFr, "Je suis d'accord");
  assert.equal(agree?.literalTrapEn, 'I am agree');
  assert.ok(agree?.acceptedEn.includes('I agree'));
  assert.ok(!agree?.acceptedEn.some((a) => a.toLowerCase().includes('i am agree')));

  const livedHere = getDrill('lived-here');
  assert.ok(livedHere);
  assert.equal(livedHere?.promptFr, "J'habite ici depuis 3 ans");
  assert.equal(livedHere?.literalTrapEn, 'I live here since 3 years');
  assert.ok(livedHere?.acceptedEn.includes('I have lived here for 3 years'));
  assert.ok(livedHere?.acceptedEn.includes("I've lived here for 3 years"));
});

test('getDrill returns undefined for an unknown id', () => {
  assert.equal(getDrill('does-not-exist'), undefined);
});
