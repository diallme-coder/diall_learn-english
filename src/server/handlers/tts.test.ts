import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ttsHandler } from './tts.ts';
import { buildFakeDeps } from '../deps.ts';
import { fakeJwt, makeGetRequest } from '../fixtures/requests.ts';
import { createFakeAuth, createFakeSynthesizer } from '../../lib/ports/index.ts';
import type { ServerDeps } from '../deps.ts';
import { SHADOWING_ITEMS } from '../../lib/levels/index.ts';

const ORIGIN = 'https://parle-to-speak.app';

function authedDeps(): { deps: ServerDeps; token: string } {
  const deps = buildFakeDeps({ allowedOrigins: [ORIGIN] });
  const token = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
  deps.auth = createFakeAuth({ [token]: { userId: 'u1', accessToken: token } });
  return { deps, token };
}

test('ttsHandler: an unknown id is 404', async () => {
  const { deps, token } = authedDeps();
  const req = makeGetRequest('https://parle-to-speak.app/api/tts?catalog=shadowing&id=not-real', {
    origin: ORIGIN,
    authorization: `Bearer ${token}`,
  });
  const res = await ttsHandler(req, deps);
  assert.equal(res.status, 404);
});

test('ttsHandler: a sensitive practice word is 404', async () => {
  const { deps, token } = authedDeps();
  const req = makeGetRequest('https://parle-to-speak.app/api/tts?catalog=practice_word&id=bitch', {
    origin: ORIGIN,
    authorization: `Bearer ${token}`,
  });
  const res = await ttsHandler(req, deps);
  assert.equal(res.status, 404);
});

test('ttsHandler: serves audio, immutable cache header, and the synthesizer runs only once across two requests', async () => {
  const { deps, token } = authedDeps();
  const synth = createFakeSynthesizer([{ ok: true, value: new Uint8Array([9, 9, 9]) }]);
  deps.tts = synth;
  const item = SHADOWING_ITEMS[0]!;
  const makeReq = () =>
    makeGetRequest(`https://parle-to-speak.app/api/tts?catalog=shadowing&id=${item.id}`, {
      origin: ORIGIN,
      authorization: `Bearer ${token}`,
    });

  const res1 = await ttsHandler(makeReq(), deps);
  assert.equal(res1.status, 200);
  assert.equal(res1.headers.get('content-type'), 'audio/mpeg');
  assert.equal(res1.headers.get('cache-control'), 'public, max-age=31536000, immutable');

  const res2 = await ttsHandler(makeReq(), deps);
  assert.equal(res2.status, 200);
  assert.equal(synth.calls.length, 1, 'the synthesizer must only be called once; the second request hits the cache');
});
