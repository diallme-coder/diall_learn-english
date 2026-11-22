# Parle-to-Speak

Parle-to-Speak is a voice-first, mobile-first PWA where French speakers practise speaking English out loud. It targets the gap between understanding English and saying it under pressure. Sessions are short and spoken. The app answers in English, keeps the conversation going when the learner slips into French, and shows a side card with the English phrase. A pronunciation check flags the sound traps that French speakers meet most often.

## Features

- **Franglais safety net.** A French word mid-sentence is accepted. The AI replies in English and a side card shows the English equivalent.
- **Pronunciation intelligibility check.** It targets H (aspirated and silent), TH, and short and long vowels. It uses Whisper word text and a coarse confidence to flag probably-misheard words. It does not grade accent or fluency. Stress and rhythm appear as practice content only.
- **Levels.** A1-A2 Guided Shadowing. B1-B2 Guided Roleplay. C1 Debate and Idioms, with feedback after the call. Levels also set the interface language and the amount of French support.
- **Daily drill.** A 120-second "Stop Translating Word-for-Word" set of literal-translation-habit micro-drills. Items repeat on a spaced-repetition schedule.
- **Progress.** Streak, weak phonemes, vocabulary and recent sessions, stored in Supabase.
- **Privacy controls.** Age gate, versioned consent for microphone use, data export and account deletion.
- **Installable PWA.** A manifest, a hand-written service worker and an offline shell for the core screens. Offline support is best effort.

## v1 scope: push-to-talk only

v1 uses push-to-talk. The conversation loop is: record, `POST /api/transcribe`, `POST /api/chat`, then `GET /api/tts`.

Realtime audio over WebRTC is **deferred to v2 by design**. It is not an oversight. v1 contains no realtime route, no realtime token endpoint and no realtime client module.

## Architecture

Next.js 15 App Router with TypeScript. The code is split by dependency rule:

| Path | Contents | Rule |
|---|---|---|
| `src/lib/**` | Core logic: prompts, levels, drills, pronunciation scoring, SRS, security helpers, UI state reducers | No framework and no provider SDK. Runs directly with `node --experimental-strip-types`. |
| `src/server/**` | Route handlers, provider and Supabase adapters, env loading | Calls providers with `fetch`. Never imported by client code. |
| `src/client/**`, `src/components/**` | Browser modules and React components | Imports only the client-safe closure. `scripts/check-boundaries.mjs` enforces this. |
| `app/**` | Next.js pages and API route files | Thin wrappers over `src/`. |
| `supabase/` | Migration, RLS tests, local test runner | Postgres SQL only. |
| `scripts/` | Boundary, route and docs checkers, precache and icon generators | Plain Node, no npm dependencies. |

| Layer | Choice |
|---|---|
| App framework | Next.js 15 (App Router) with TypeScript |
| Speech to text | OpenAI Whisper (`whisper-1`) through `POST /v1/audio/transcriptions` |
| Text to speech | OpenAI TTS through `POST /v1/audio/speech`, with the browser `speechSynthesis` as fallback |
| Chat and feedback | Anthropic Messages API (`POST /v1/messages`). OpenAI chat is used when `LLM_PROVIDER=openai`. |
| Storage and auth | Supabase Postgres with row-level security (RLS), and Supabase Auth email one-time codes |
| Offline | PWA manifest and a hand-written service worker (`public/sw.js`) |

The project has **no provider SDK packages**. Every OpenAI, Anthropic and Supabase call is plain `fetch`.

### Known environment limitation: `.tsx` files

The build sandbox had no `node_modules` and no React type definitions. The `src/lib/**` and `src/server/**` code was type-checked (0 errors). The Next.js `.tsx` files were checked for compile correctness only. They have not been built or type-checked against real packages.

Anyone who picks up the repo with npm access must run these before release:

```bash
npm install
npx tsc --noEmit
npm run build
```

## Setup

**Prerequisites:** Node.js 22.6 or later (`engines` in `package.json`), a Supabase project in an EU region, and OpenAI and Anthropic API keys.

1. Install dependencies.

   ```bash
   npm install
   ```

2. Copy the example environment file and fill in the values.

   ```bash
   cp .env.example .env.local
   ```

   `.env.example` lists the same variables as the table below. `scripts/check-docs.mjs` fails if this README omits one of them.

3. Set up Supabase (see [Supabase setup](#supabase-setup)).

4. Start the dev server and open `http://localhost:3000`.

   ```bash
   npm run dev
   ```

### Environment variables

Defaults come from `src/server/env.ts` and the adapters. Leave a variable unset to use its default.

| Variable | Read by | Required | Default | Purpose |
|---|---|---|---|---|
| `OPENAI_API_KEY` | Server only | Yes | none | Whisper transcription and TTS. Also chat when `LLM_PROVIDER=openai`. |
| `ANTHROPIC_API_KEY` | Server only | When `LLM_PROVIDER=anthropic` | none | Chat and debate feedback |
| `LLM_PROVIDER` | Server only | No | `anthropic` | `anthropic` or `openai` |
| `ANTHROPIC_MODEL` | Server only | No | `claude-3-5-haiku-latest` | Claude model ID for chat and feedback. Haiku is the cost-conscious default. |
| `OPENAI_CHAT_MODEL` | Server only | No | `gpt-4o-mini` | Chat model when `LLM_PROVIDER=openai`. `gpt-4o` is the quality upgrade. |
| `OPENAI_TTS_MODEL` | Server only | No | `tts-1` | TTS model. `tts-1-hd` is the quality upgrade. |
| `OPENAI_TTS_VOICE` | Server only | No | `alloy` | TTS voice. Options include `alloy`, `echo`, `fable`, `onyx`, `nova` and `shimmer`. Check the OpenAI TTS API reference for newer voice names. |
| `SUPABASE_URL` | Server only | Yes | none | Base URL for PostgREST and GoTrue calls made with the user's JWT |
| `SUPABASE_ANON_KEY` | Server only | Yes | none | Publishable key for those calls. An `sb_publishable_` key also works. |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser | Yes | none | GoTrue auth requests from the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser | Yes | none | Publishable key for browser auth. An `sb_publishable_` key also works. |
| `ALLOWED_ORIGINS` | Server only | Yes in production | none | Comma-separated origin allowlist for API calls. The server refuses to start in production without it. |
| `TRUSTED_PROXY_HOPS` | Server only | No | `1` | Number of trusted proxies when reading `X-Forwarded-For` for the per-IP rate limit |

Notes:

- Transcription always uses `whisper-1`. It is set in `src/server/adapters/openaiTranscriber.ts`. There is no `OPENAI_TRANSCRIBE_MODEL` variable. Setting one has no effect.
- The server also accepts `SUPABASE_PUBLISHABLE_KEY` as a fallback for `SUPABASE_ANON_KEY`. It is not in `.env.example`.

Rules that apply to every variable:

- Provider and service keys stay in server environment variables. Never prefix them with `NEXT_PUBLIC_`, never log them and never put them in a URL.
- The browser receives only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- The project has no service-role key. Do not add one.

## Supabase setup

1. Create the project in an **EU region**.
2. Apply the migration `supabase/migrations/20261121000000_init.sql`. It creates the eight tables, RLS policies, grants, check constraints and RPC functions. Run it in the SQL editor, or apply it with the Supabase CLI against your linked project. Neither method was run in this sandbox.
3. **Enable the `drill_attempts` retention job. This step is required.** The migration ships the retention SQL, which deletes drill attempts older than 365 days, commented out. It needs `pg_cron`. Enable it, uncomment the `cron.schedule` line, and run it. The app does not limit how many drill rows one user creates, so this job is the only bound.
4. Enable **email one-time-code sign-in** in Supabase Auth.
5. Use a `sb_publishable_` key in the anon-key variables if your project issues one.

## Provider setup

- **OpenAI.** Request zero data retention where your account is eligible. Sign the Data Processing Agreement (DPA).
- **Anthropic.** Sign the DPA and review the commercial terms.

## Scripts and checks

`package.json` defines these npm scripts:

| Command | What it runs | Status in the build sandbox |
|---|---|---|
| `npm run dev` | `next dev` | Not run (no `node_modules`) |
| `npm run build` | `next build` | Not run (no `node_modules`) |
| `npm start` | `next start` | Not run (no `node_modules`) |
| `npm test` | Node test runner over `src/**/*.test.ts` | 428 of 428 pass |
| `npm run typecheck:lib` | `tsc -p tsconfig.lib.json` | Exit 0. The script hard-codes a sandbox path to `tsc`. Use the `npx` command below instead. |

Other checks are not npm scripts. Run them directly:

| Command | What it checks | Status |
|---|---|---|
| `node --experimental-strip-types --test $(find src -name '*.test.ts')` | Same unit tests as `npm test`, with the file list expanded by `find` | 428 of 428 pass |
| `node scripts/check-boundaries.mjs` | Client import closure never reaches `src/server/**` or `src/lib/prompts/**`, and other boundary rules | OK |
| `node scripts/check-routes.mjs` | Every expected route and API route file exists | OK |
| `node scripts/check-docs.mjs` | Every `.env.example` variable appears in this README | OK |
| `bash supabase/tests/run-local.sh` | Migration and RLS tests against a local Postgres 16 | 15 of 15 assertions pass |
| `npx tsc -p tsconfig.server.json` | Type-checks `src/server/**` and `src/lib/**` | Exit 0 |
| `npx tsc -p tsconfig.lib.json` | Type-checks `src/lib/**` | Exit 0 |
| `npx tsc --noEmit` | Type-checks everything, including `.tsx` | Not run. It needs installed React and Next types. |
| `node scripts/gen-precache.mjs` | Rewrites the `PRECACHE` list in `public/sw.js` from the `.next/` build output | Not run (no `next build`) |

Notes:

- `package.json` has no `postbuild` hook. After `next build`, run `node scripts/gen-precache.mjs` by hand. The hook is a follow-up.
- `npx tsc -p ...` commands need `npm install` first. The `npx` forms were not run in this sandbox. Their results above came from the sandbox's `tsc`.

### Local RLS test

`bash supabase/tests/run-local.sh` runs the migration and `supabase/tests/rls.sql` against a throwaway Postgres 16 server. It:

1. Looks for the Postgres 16 binaries in `/usr/lib/postgresql/16/bin`. It skips with a message if they are missing.
2. Creates a temporary data directory with `mktemp -d`.
3. Starts a server on port 54329 with that directory.
4. Applies `supabase/tests/00_auth_stub.sql`, the migration, and then `supabase/tests/rls.sql`, each with `ON_ERROR_STOP=1`.
5. Stops the server and removes the directory on exit.

Postgres refuses to run `initdb` and `pg_ctl` as root. When `id -u` returns `0`, the script gives the temporary directory to the `postgres` user and runs each Postgres command with `runuser -u postgres --`. A non-root user needs no extra step.

The test uses a stub `auth` schema, not real Supabase Auth. It proves the policies and RPCs, not the sign-in flow.

## Privacy

- The app does not keep audio in its own database.
- Audio and transcripts go to **OpenAI** for transcription and speech. They go to **Anthropic** for chat and feedback, or to **OpenAI** when `LLM_PROVIDER=openai`. Those providers process the data under their own terms. This project makes no claim that either provider never stores it.
- Microphone features need a recorded consent at the current `PRIVACY_CONSENT_VERSION`, which is `2026-11-21`. `/api/transcribe` checks this on the server and refuses the request with `403` when consent is missing or the check fails.
- Age handling at sign-in:
  - under 15: blocked, and the age is not stored;
  - 15-17: stored as `15-17`, and the sensitive-content reveal is disabled;
  - 18 and over: stored as `18+`.
- Typed answers are stored as text. Spoken answers are stored without their text. The database rejects a spoken attempt that carries text.
- **Export.** The Privacy page (`/privacy`) downloads a JSON file with your profile, sessions, vocabulary, weak phonemes, drill attempts, SRS cards and consent records. It comes from `GET /api/privacy?export=1` with `Content-Disposition: attachment`.
- **Delete.** The Privacy page enables deletion only after you type `SUPPRIMER`. Deletion removes your rows from the eight public tables. It does **not** delete your Supabase Auth user row. It also does not sign you out or clear on-device data in this build. See the known limitations.

Security controls and their test paths are in [`docs/SECURITY.md`](docs/SECURITY.md). The Privacy page at `/privacy` shows the processor disclosure to users.

## Known limitations and follow-ups

### Product limits

- **Not a pronunciation grade.** The pronunciation check is an intelligibility check. It does not measure accent or fluency.
- **Calibration is not done.** Scoring is tested against synthetic Whisper-style fixtures only. `src/lib/pronunciation/fixtures/real/` holds only a README. The real-clip calibration (CAL-01, CAL-02) is open, and its threshold N is not set. See [`docs/MANUAL_QA.md`](docs/MANUAL_QA.md).
- **Stress is not detected.** Stress and rhythm appear as practice content and diagrams. The scorer never reports them.
- **Whisper may anglicise French.** Code-switch detection is best effort. The transcription prompt and the false-friend list reduce the miss rate.
- **Realtime is v2.** v1 is push-to-talk only.
- **Offline support is best effort.** The service worker caches the core shell and drills. Roleplay, debate and live scoring need a connection.
- **Speech output depends on the device.** If no English voice exists, the app falls back to text only.

### Known gaps and v1.1 follow-ups

- **Shadowing highlight timing is approximate.** Live playback word highlighting is proportional to character length. It is not real TTS word-timing data. The post-recording pronunciation score is real. It is driven by the Whisper output.
- **`record_vocab` is not idempotent.** `record_drill_attempt` and `delete_my_account` are.
- **No `drill` purpose for transcription.** `TranscribePurpose` has no `drill` value yet. Drills reuse `chat`.
- **Progress range toggle is cosmetic.** The 7-day and 30-day toggle on `/progress` has no day-bucketed data yet.
- **`LiveTranscript.tsx` is not wired** into any screen.
- **Account deletion is incomplete.** Deletion does not remove the Supabase Auth user row (email). It needs a service-role admin call, which this build does not have.
- **Delete does not clear on-device data or sign out.** The Privacy page calls the delete API and shows the result. It does not clear the IndexedDB data on the device.
- **Rate limiter is per instance.** The in-memory limiter, its daily budgets and the negative token cache are not shared between server instances. Use a shared store, such as Redis, before multi-instance production use. The limiter sits behind a port, so a shared store can replace it. The in-memory maps have no eviction or size cap yet.
- **Security follow-ups** (rate-limit IP trust, CORS preflight, MIME sniffing, database check constraints, grants, CSP and HSTS) are listed in [`docs/SECURITY.md`](docs/SECURITY.md).

## Documentation

- [`docs/PLAN.md`](docs/PLAN.md): build plan, acceptance tags and risk register.
- [`docs/design/`](docs/design/): design inputs 01-05 (brief, information architecture, key screens, voice UX, accessibility).
- [`docs/SECURITY.md`](docs/SECURITY.md): security and privacy controls S1-S17, their files, tests and status.
- [`docs/MANUAL_QA.md`](docs/MANUAL_QA.md): manual checks that need a browser, a device, a real Supabase project or a human reviewer.
