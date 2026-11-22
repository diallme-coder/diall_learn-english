import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_LOCAL_STORE, GUEST_KEY, migrateGuestData, reduceLocalStore } from './localStoreReducers.ts';

test('state is keyed by userId, guest data lives under GUEST_KEY', () => {
  let state = reduceLocalStore(EMPTY_LOCAL_STORE, { type: 'term_ignored', userId: null, term: 'croissant' });
  assert.deepStrictEqual(state[GUEST_KEY]?.ignoredTerms, ['croissant']);
  assert.strictEqual(state['user-1'], undefined);

  state = reduceLocalStore(state, { type: 'term_ignored', userId: 'user-1', term: 'baguette' });
  assert.deepStrictEqual(state['user-1']?.ignoredTerms, ['baguette']);
  // the guest bucket is untouched by a user action
  assert.deepStrictEqual(state[GUEST_KEY]?.ignoredTerms, ['croissant']);
});

test('migrateGuestData only runs when explicitly called, never implicitly from reduceLocalStore', () => {
  let state = reduceLocalStore(EMPTY_LOCAL_STORE, { type: 'term_ignored', userId: null, term: 'croissant' });
  // signing in (a settings_updated/other action keyed to the user) does NOT pull in guest data.
  state = reduceLocalStore(state, { type: 'term_ignored', userId: 'user-1', term: 'baguette' });
  assert.deepStrictEqual(state['user-1']?.ignoredTerms, ['baguette']);
  assert.ok(state[GUEST_KEY] !== undefined, 'guest bucket still exists, untouched');

  // only this explicit call moves guest data into the user's bucket.
  state = migrateGuestData(state, 'user-1');
  assert.strictEqual(state[GUEST_KEY], undefined);
  assert.ok(state['user-1']?.ignoredTerms.includes('croissant'));
  assert.ok(state['user-1']?.ignoredTerms.includes('baguette'));
});

test('migrateGuestData is a no-op when there is no guest bucket', () => {
  const state = reduceLocalStore(EMPTY_LOCAL_STORE, { type: 'term_ignored', userId: 'user-1', term: 'baguette' });
  const migrated = migrateGuestData(state, 'user-1');
  assert.deepStrictEqual(migrated, state);
});
