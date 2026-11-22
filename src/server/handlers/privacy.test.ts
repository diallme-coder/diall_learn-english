import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privacyHandler } from './privacy.ts';
import { buildFakeDeps } from '../deps.ts';
import { fakeJwt, makeGetRequest, makeJsonRequest } from '../fixtures/requests.ts';
import { createFakeAuth } from '../../lib/ports/index.ts';
import type { ServerDeps } from '../deps.ts';

const ORIGIN = 'https://parle-to-speak.app';
const URL = 'https://parle-to-speak.app/api/privacy';

function authedDeps(): { deps: ServerDeps; token: string } {
  const deps = buildFakeDeps({ allowedOrigins: [ORIGIN] });
  const token = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
  deps.auth = createFakeAuth({ [token]: { userId: 'u1', accessToken: token } });
  return { deps, token };
}

test('privacyHandler: GET ?export=1 returns a PrivacyExport with a Content-Disposition attachment header', async () => {
  const { deps, token } = authedDeps();
  const req = makeGetRequest(`${URL}?export=1`, { origin: ORIGIN, authorization: `Bearer ${token}` });
  const res = await privacyHandler(req, deps);
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-disposition')?.includes('attachment'));
  const body = await res.json();
  assert.ok('exportedAt' in body);
});

test('privacyHandler: GET without ?export=1 is 400', async () => {
  const { deps, token } = authedDeps();
  const req = makeGetRequest(URL, { origin: ORIGIN, authorization: `Bearer ${token}` });
  const res = await privacyHandler(req, deps);
  assert.equal(res.status, 400);
});

test('privacyHandler: POST accept_consent records the consent and returns {ok: true}', async () => {
  const { deps, token } = authedDeps();
  const req = makeJsonRequest(
    URL,
    { action: 'accept_consent', version: '2026-11-21', ageBand: '18+' },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const res = await privacyHandler(req, deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { ok: true });
});

test('privacyHandler: POST delete_account requires the literal confirm string "SUPPRIMER"', async () => {
  const { deps, token } = authedDeps();
  const bad = makeJsonRequest(
    URL,
    { action: 'delete_account', confirm: 'yes' },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const badRes = await privacyHandler(bad, deps);
  assert.equal(badRes.status, 400);

  const good = makeJsonRequest(
    URL,
    { action: 'delete_account', confirm: 'SUPPRIMER' },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const goodRes = await privacyHandler(good, deps);
  assert.equal(goodRes.status, 200);
});
