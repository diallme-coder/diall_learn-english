import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progressHandler } from './progress.ts';
import { buildFakeDeps } from '../deps.ts';
import { fakeJwt, makeGetRequest, makeJsonRequest } from '../fixtures/requests.ts';
import { createFakeAuth } from '../../lib/ports/index.ts';
import type { ServerDeps } from '../deps.ts';

const ORIGIN = 'https://parle-to-speak.app';
const URL = 'https://parle-to-speak.app/api/progress';

function authedDeps(): { deps: ServerDeps; token: string } {
  const deps = buildFakeDeps({ allowedOrigins: [ORIGIN] });
  const token = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
  deps.auth = createFakeAuth({ [token]: { userId: 'u1', accessToken: token } });
  return { deps, token };
}

test('progressHandler: GET returns a ProgressSnapshot', async () => {
  const { deps, token } = authedDeps();
  const req = makeGetRequest(`${URL}?tz=60`, { origin: ORIGIN, authorization: `Bearer ${token}` });
  const res = await progressHandler(req, deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.streakDays, 0);
});

test('progressHandler: GET with an out-of-range tz is 400', async () => {
  const { deps, token } = authedDeps();
  const req = makeGetRequest(`${URL}?tz=5000`, { origin: ORIGIN, authorization: `Bearer ${token}` });
  const res = await progressHandler(req, deps);
  assert.equal(res.status, 400);
});

test('progressHandler: POST rejects a client-sent pronunciation_report (403/forbidden)', async () => {
  const { deps, token } = authedDeps();
  const req = makeJsonRequest(
    URL,
    { eventId: '11111111-1111-1111-1111-111111111111', type: 'pronunciation_report', trapCounts: [] },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const res = await progressHandler(req, deps);
  assert.equal(res.status, 403);
});

test('progressHandler: POST a valid level_set event records it and returns {ok: true}', async () => {
  const { deps, token } = authedDeps();
  const req = makeJsonRequest(
    URL,
    { eventId: '11111111-1111-1111-1111-111111111111', type: 'level_set', level: 'B1' },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const res = await progressHandler(req, deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { ok: true });
  // @ts-expect-error -- fake progress store exposes recordedEvents
  assert.equal(deps.progress.recordedEvents.length, 1);
});

test('progressHandler: POST a drill_attempt with ease 1.2 (out of [1.3, 5]) is 400', async () => {
  const { deps, token } = authedDeps();
  const req = makeJsonRequest(
    URL,
    {
      eventId: '11111111-1111-1111-1111-111111111111',
      type: 'drill_attempt',
      attempt: {
        id: '22222222-2222-2222-2222-222222222222',
        itemId: 'age-25',
        answer: null,
        correct: true,
        grade: 'good',
        durationMs: 1000,
        inputMode: 'spoken',
        answeredAt: Date.now(),
      },
      card: {
        itemId: 'age-25',
        ease: 1.2,
        intervalDays: 1,
        repetitions: 1,
        lapses: 0,
        dueAt: Date.now(),
        lastReviewedAt: null,
      },
    },
    { origin: ORIGIN, authorization: `Bearer ${token}` },
  );
  const res = await progressHandler(req, deps);
  assert.equal(res.status, 400);
});
