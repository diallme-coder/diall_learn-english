# Security and privacy controls

This document lists the security and privacy controls in the final build, their owning files, the tests that cover them, and their status. It comes from a security review of the code. A status below is a claim about the code as it stands, not a plan.

## Status key

- **Verified.** The control is in the code and its tests pass.
- **Fixed.** A gap found in the final review was closed and tested.
- **Partial.** The control works for the core path. A named gap remains. The gap is listed under the row and under [Known gaps and follow-ups](#known-gaps-and-follow-ups).
- **Open.** Not yet implemented. Listed as a follow-up.

Test results come from `node --experimental-strip-types --test $(find src -name '*.test.ts')` (428 of 428 pass), `node scripts/check-boundaries.mjs` (OK), `node scripts/check-routes.mjs` (OK), and `bash supabase/tests/run-local.sh` (15 of 15 RLS assertions pass). Manual checks are cross-referenced to [`MANUAL_QA.md`](MANUAL_QA.md).

## Controls S1-S17

| # | Control | Owning files | Test or check | Status |
|---|---|---|---|---|
| S1 | Provider and service keys live in server environment variables only. They never carry the `NEXT_PUBLIC_` prefix, never reach logs and never appear in a URL. | `src/server/env.ts`, `src/server/adapters/*.ts`, `scripts/check-boundaries.mjs` (rules 1 and 2) | check-boundaries; adapter tests in `src/server/adapters/*.test.ts` | Verified |
| S2 | The client import closure never reaches `src/server/**` or `src/lib/prompts/**`. The project has no provider or Supabase SDK package. | `scripts/check-boundaries.mjs` (rules 1, 1b, 7), `package.json`, `src/client/**`, `src/components/**` | check-boundaries; `package.json` lists no SDK | Verified |
| S3 | No provider credential reaches the browser in v1. Realtime is deferred, so no browser-to-OpenAI traffic exists. | `next.config.ts` (`connect-src` has no OpenAI origin) | check-boundaries rule 7; CSP check PWA-03 in `MANUAL_QA.md` | Verified |
| S4 | Prompt-injection defence. Learner text is sanitised and wrapped as data before it reaches the model. | `src/lib/security/sanitize.ts`, `src/lib/prompts/debateFeedback.ts`, `src/server/handlers/chat.ts` | `sanitize.test.ts` (includes the end-to-end injection case), `chat.test.ts`, `debateFeedback.test.ts` | Fixed. The final review wrapped learner text with `sanitizeForPrompt` and `wrapLearnerUtterance` before it reached the LLM. |
| S5 | Auth. The JWT `exp` is prechecked in seconds, then the token is verified with GoTrue. Results are cached briefly, never past `exp`, and keyed by the SHA-256 of the token. The millisecond and second units are handled correctly. | `src/lib/security/jwt.ts`, `src/server/adapters/supabaseAuth.ts`, `src/server/handlers/common.ts` | `jwt.test.ts`, `supabaseAuth.test.ts` (including `exp` boundary cases), `common.test.ts` | Verified |
| S6 | The database is the real boundary. It has explicit grants, RLS on all four verbs, SQL check constraints that mirror the TypeScript limits, and three `security definer` RPCs (`record_drill_attempt`, `record_vocab`, `delete_my_account`), each scoped to `auth.uid()`. `increment_weak_phonemes` is `security invoker`. | `supabase/migrations/20261121000000_init.sql`, `supabase/tests/rls.sql`, `supabase/tests/run-local.sh` | `src/lib/db/migration.test.ts`; `bash supabase/tests/run-local.sh` (15 of 15) | Verified. See S10 for the direct-write gap. |
| S7 | Rate limits. The IP bucket runs before auth. The per-user bucket and the daily paid-call budget run after auth. Every route is wired in. Limits are per instance. | `src/lib/security/rateLimit.ts`, `src/lib/security/clientIp.ts`, `src/server/handlers/common.ts`, `src/lib/types.ts` (`RATE_LIMITS`) | rateLimit, clientIp and handler tests; LIVE-03 in `MANUAL_QA.md` | Partial. See the gaps below. |
| S8 | Same-origin or allowlisted origins only. The server never sends an `Access-Control-Allow-Origin` header. CORS is checked per route. | `src/lib/security/origin.ts`, `src/server/handlers/common.ts` | `origin.test.ts`; LIVE-04 in `MANUAL_QA.md` | Partial. A foreign `OPTIONS` preflight is answered by Next's default handling, not by the origin check. LIVE-04 covers `POST` only. |
| S9 | Audio. The 4 MB cap is enforced while the body streams, before `formData()` parses it. Silence and hallucination guards run on the server and on the client. | `src/lib/security/audio.ts`, `src/lib/codeswitch/hallucinations.ts`, `src/lib/ui/recorderGate.ts`, `src/client/recorder.ts`, `src/server/handlers/transcribe.ts` | `audio.test.ts`, `transcribe.test.ts`, `hallucinations.test.ts`, `recorderGate.test.ts`; LIVE-06 in `MANUAL_QA.md` | Partial. MIME sniffing from magic bytes is not implemented. See the gaps below. |
| S10 | Scoring integrity. The server transcribes the audio itself, so clients cannot post a transcript. Clients cannot post a `pronunciation_report` event. | `src/server/handlers/transcribe.ts`, `src/lib/security/validate.ts` (`parseProgressEvent`), `src/lib/types.ts` | `transcribe.test.ts`, `validate.test.ts`; LIVE-02 in `MANUAL_QA.md` | Partial. Application-layer only. The `anon` and `authenticated` roles can still write some tables directly through RLS-permitted REST calls. See the gaps below. |
| S11 | Input bounds. Request bodies are capped at 64 KB. Field bounds apply. Event ranges are checked in code. The record-vocab item cap of 50 is also enforced in SQL. | `src/lib/security/validate.ts`, `src/lib/types.ts` (`LIMITS`), `supabase/migrations/20261121000000_init.sql` | `validate.test.ts`, `migration.test.ts`, `supabase/tests/rls.sql` | Partial. Database-level check constraints for timestamp windows and `jsonb` size are not yet added. |
| S12 | Upstream errors are not leaked. Secrets and transcripts stay out of logs. Upstream failures become a generic 502 or 504. | `src/server/fetchJson.ts`, `src/server/http.ts`, `src/server/adapters/*.ts` | `fetchJson.test.ts`, `http.test.ts`, adapter tests; LIVE-05 in `MANUAL_QA.md` | Verified |
| S13 | Response headers. A CSP, `X-Content-Type-Options: nosniff`, `Permissions-Policy: microphone=(self), camera=(), geolocation=()`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'`. API responses send `Cache-Control: no-store`. | `next.config.ts`, `src/server/http.ts` | PWA-03 and PWA-06 in `MANUAL_QA.md`; handler tests | Partial. Production `script-src` still includes `'unsafe-inline'`. No HSTS header is set. |
| S14 | The service worker never caches `/api/*`, RSC responses, redirected responses or non-200 responses. | `public/sw.js`, `scripts/gen-precache.mjs`, `next.config.ts` (`/sw.js` is served with `no-cache`) | `src/lib/pwa/sw.test.ts` (loads `public/sw.js` in `node:vm`); check-boundaries rule 6; PWA-07 in `MANUAL_QA.md` | Verified |
| S15 | Privacy. An honest processor disclosure. Versioned consent gates microphone use, enforced on the server. An age gate. Export and delete. Typed-only answer storage. A retention job. | `src/lib/types.ts` (`PRIVACY_CONSENT_VERSION`), `supabase/migrations/20261121000000_init.sql`, `src/server/handlers/transcribe.ts`, `src/server/adapters/supabasePrivacy.ts`, `app/(app)/privacy/page.tsx`, `src/lib/ui/strings.ts` | `rls.sql` (including the check that another user's `auth.users` row survives a delete); `migration.test.ts`; `privacy.test.ts`; PRIV-01 to PRIV-13 in `MANUAL_QA.md` | Partial. Consent gating is fixed: `/api/transcribe` fails closed when consent is missing or the check errors. The onboarding Decline button no longer writes a consent record. Account deletion does not remove the Auth user row. The retention job and the EU region and DPAs are operator steps. |
| S16 | Sensitive content stays out of practice, TTS, drills and random content. The reveal control is hidden by default and disabled for ages 15-17. The `beach` and rude-word pair shows only `beach`. | `src/lib/pronunciation/sensitive.ts`, `src/lib/drills/catalog.ts`, `src/lib/levels/shadowing.ts`, `src/server/handlers/tts.ts`, `src/components/core/TrapCard.tsx` | `sensitive.test.ts`, `catalog.test.ts`, `tts.test.ts` (the sensitive pair returns 404); CORE-07 in `MANUAL_QA.md` | Verified |
| S17 | No `dangerouslySetInnerHTML` and no `innerHTML` anywhere in the app. | `src/components/**`, `app/**`, `src/**` | Source search: no matches | Verified |

## Risks R1-R6

| # | Risk | Mitigation in the build | Status |
|---|---|---|---|
| R1 | Next 15 and `.ts`-extension imports | `allowImportingTsExtensions` with `noEmit` in `tsconfig.lib.json` and `tsconfig.server.json` | Open. Needs `next build` on a machine with `npm install`. Check BLD-05. |
| R2 | Whisper confidence is coarse (segment level) | Default confidence, `unsure` bands, and warnings shown only in sentences. Labelled as an intelligibility check. | Mitigated in code and tested on synthetic fixtures. Real-clip calibration is open (CAL-01, CAL-02). |
| R3 | Whisper silence hallucinations or anglicisation | No-speech threshold, hallucination denylist, client recorder gate, false-friend lists | Mitigated in code and tested. The live check LIVE-06 is open. |
| R4 | The in-memory rate limiter is per instance | Documented in the README and here. The limiter sits behind a port. Daily budgets bound the cost per instance. | Open. A shared store is needed before multi-instance production use. |
| R5 | TypeScript versions differ between the sandbox and the project's TypeScript 5.8 | `tsconfig.lib.json` uses only options both versions support | Open. The `typecheck:lib` script still points at a sandbox `tsc` path. Check BLD-04. |
| R6 | The privacy copy needs legal review | Copy lives in `strings.ts` keys | Open. Legal review is a manual item (PRIV-09). Engineering cannot close it. |

## Known gaps and follow-ups

These gaps are real in the final build. Treat each one as open until its follow-up lands.

| Area | Gap | Follow-up |
|---|---|---|
| S7 | `X-Real-IP` is trusted unconditionally. It is not trusted only when a proxy configuration says so. | Trust forwarded IP headers only through a trusted-proxy configuration, tied to `TRUSTED_PROXY_HOPS`. |
| S7 | The in-memory rate-limit maps and the negative token cache have no eviction and no size cap. | Add an eviction policy and a cap before scaling. Fine for a single instance at low traffic. |
| S7, R4 | Limits are per instance. | Move the limiter to a shared store behind its port. |
| S8 | A foreign `OPTIONS` preflight is answered by Next's default handling, so the origin check does not apply to it. | Answer preflight in the origin check, and return 403 for a foreign origin. |
| S9 | Audio MIME type is not checked against magic bytes. | Sniff the MIME type from magic bytes after the 4 MB cap. |
| S10 | The `anon` and `authenticated` roles can write some tables, such as `weak_phonemes`, directly through RLS-permitted REST calls. Those writes bypass the app-layer invariants. | Restrict grants to `select` only, and route all writes through RPC functions. |
| S11 | Database check constraints for timestamp windows and `jsonb` size are not yet added. | Add the constraints in a new migration, and test them in `rls.sql`. |
| S13 | Production `script-src` includes `'unsafe-inline'`. There is no HSTS header. | Move scripts to nonces or hashes. Add `Strict-Transport-Security` at the HTTPS edge. |
| S15 | Account deletion removes the eight public-table rows for the user. It does not remove the Supabase Auth user row. | Add a service-role admin call. This build has no service-role key, by design. |
| S15 | The Privacy page does not sign the user out or clear on-device data after deletion. | Sign out and clear the IndexedDB data after a successful delete. |
| S15 | The retention job is commented out in the migration. | Operator step: enable `pg_cron`, uncomment the `cron.schedule` line, and confirm the job in the Supabase cron list (PRIV-12). |
| S15 | `record_vocab` is not idempotency-guarded. `record_drill_attempt` and `delete_my_account` are. | Add an idempotency key to `record_vocab`. |

## Open items that affect this document

- **Shared rate-limit store** before public launch (S7, R4).
- **Calibration threshold N** for the pronunciation check. It is set after the first real clips (CAL-02).
- **Legal review of the privacy copy** (R6, PRIV-09).
- **Guest scope.** Signed-out users reach drills, the trap library and shadowing playback with browser TTS. Other features need sign-in. The lead should confirm this scope (AUTH-04).

## Verification status of this document

The controls above were checked against the code and tests in the repository. The checks ran in a sandbox with no `node_modules` and no network access. These were **not** run:

- `next build` and a real `tsc --noEmit` with React and Next types.
- Live calls to OpenAI and Anthropic (LIVE-01 to LIVE-06).
- A real Supabase project with real GoTrue sign-in (AUTH-01).
- Browser, device and headers checks in production (PWA-03, PWA-06).

The RLS tests run against a local Postgres 16 with a stub `auth` schema, not real Supabase Auth.
