# Manual QA checklist

This checklist covers the checks that need a browser, a device, a real Supabase project, live provider keys or a human reviewer. The automated checks run in the sandbox and are listed in the README. The SECURITY controls are in [`SECURITY.md`](SECURITY.md).

## How to use this checklist

- Each row is one check. Fill in **Tested by / date / result** when a person runs it.
- **Result** is `pass`, `fail` or `blocked`. Add a short note on failures. Link the issue.
- **Owner (role)** is the suggested role for the check. The lead assigns the person.
- Offline tests use synthetic audio. The only evidence from real audio comes from the Calibration checks (CAL) and the live API checks (LIVE). Do not mark a pronunciation claim as verified on synthetic results.
- Do not mark a check `pass` on a partial run. Mark it `blocked` and say what was missing.
- Where an expected result differs from what the code does, the row says so. Those rows record a known gap, not a pass.

## Build and integration gate

| ID | Check | Screen or flow | Expected result | Owner (role) | Tested by / date / result |
|---|---|---|---|---|---|
| BLD-01 | `npm install` completes. | Repository root | Installs `next@^15`, `react@^19` and the dev dependencies with no errors. | Engineering | |
| BLD-02 | `npm run build` completes. Then run `node scripts/gen-precache.mjs`. | Build | `package.json` has no `postbuild` hook, so the precache step is manual. After it runs, the `PRECACHE` array in `public/sw.js` sits between the `/*PRECACHE_START*/` and `/*PRECACHE_END*/` markers and holds no redirecting URL such as `/?source=pwa`. | Engineering | |
| BLD-03 | Full type check with `.tsx` files included. | Repository root | `npx tsc --noEmit` reports 0 errors. There is no npm `typecheck` script. | Engineering | |
| BLD-04 | `typecheck:lib` passes under the project's TypeScript 5.8. | Repository root | 0 errors. The current `typecheck:lib` script hard-codes a sandbox path to `tsc`. Change it to `npx tsc -p tsconfig.lib.json` first. | Engineering | |
| BLD-05 | `.ts`-extension imports in `.tsx` files compile in Next 15. | `next build` | Build passes with `allowImportingTsExtensions` and `noEmit`. If not, apply the codemod on `.tsx` imports. | Engineering | |
| BLD-06 | Server type check. | Repository root | `npx tsc -p tsconfig.server.json` reports 0 errors. | Engineering | |

## PWA, headers and offline

| ID | Check | Screen or flow | Expected result | Owner (role) | Tested by / date / result |
|---|---|---|---|---|---|
| PWA-01 | Android install prompt. | Chrome for Android, second visit | The `InstallPrompt` appears and install succeeds. The app opens standalone. | Engineering | |
| PWA-02 | iOS install instructions. | Safari on iOS, not installed | The app shows install instructions in French instead of a native prompt. The detection is in `src/lib/pwa/installPrompt.ts`. | Engineering | |
| PWA-03 | CSP does not break `next dev` or `next start`. | Dev server, then production server, with the core flows | Dev CSP adds `'unsafe-eval'` and the app runs. Production CSP runs with no console CSP violation on the core flows. Known gap: production `script-src` still includes `'unsafe-inline'`, so this check does not show that inline scripts are blocked (SECURITY S13). | Engineering | |
| PWA-04 | Lighthouse PWA audit. | Production build, Chrome | The app is installable. The manifest, icons (including maskable), service worker and `start_url` all pass. | Engineering | |
| PWA-05 | Offline shell after install. | Installed app, airplane mode | `/` loads from cache. An unknown route shows `/offline`, which says "Tu es hors ligne". Drills run from the cached set in self-check mode. AI screens show the offline state. | Engineering, Accessibility tester | |
| PWA-06 | Response headers. | Any page and any API route | `Content-Security-Policy` is present. `Permissions-Policy: microphone=(self), camera=(), geolocation=()`. `Referrer-Policy: strict-origin-when-cross-origin`. `X-Content-Type-Options: nosniff`. `frame-ancestors 'none'`. `/sw.js` sends `no-cache`. `/api/*` sends `no-store`. `/api/tts` sends `public, max-age=31536000, immutable`. There is **no** `Strict-Transport-Security` header yet (known gap, SECURITY S13). | Engineering | |
| PWA-07 | Service worker cache holds no API, RSC or redirect responses. | DevTools, Cache Storage, after a full session | No `/api/*` entry. No RSC response. No redirected or non-200 response. | Engineering | |
| PWA-08 | Icons generated with `sharp`. | `node scripts/gen-icons.mjs` | Icons are produced. If `sharp` fails, the icons are produced by hand and the step is noted. | Engineering | |

## Microphone permission

| ID | Check | Screen or flow | Expected result | Owner (role) | Tested by / date / result |
|---|---|---|---|---|---|
| MIC-01 | The app explains the microphone before the browser prompt. | Onboarding, mic step | The explanation appears first, with "Autoriser" and "Plus tard" choices. Choosing "Plus tard" offers the text-only placement. | Designer, Engineering | |
| MIC-02 | Denied microphone. | Any voice screen after denial | `MicPermissionGate` shows the steps sheet and the text mode. Pronunciation features are labelled "Nécessite le micro". | Engineering, Accessibility tester | |
| MIC-03 | Microphone in use, not found or insecure. | Each failure, forced in the browser | Each state shows its own French message and one action: device picker, retry or text mode. | Engineering | |
| MIC-04 | Recording gate. | Practice screen, push-to-talk | A recording shorter than `LIMITS.minRecordingSec` (0.4 s) shows the too-short message (reason `too_short`). A silent recording shows the silent message (reason `silent`). Neither reaches the server. | Engineering | |

## Calibration (pronunciation)

| ID | Check | Screen or flow | Expected result | Owner (role) | Tested by / date / result |
|---|---|---|---|---|---|
| CAL-01 | Record about 20 French-accented clips with minimal pairs and sentences. Store the raw `verbose_json` under `src/lib/pronunciation/fixtures/real/`. | Recording session | Clips and raw JSON are stored. The clip list covers the traps H, TH, vowels and the sentence mode. **Not done:** the `fixtures/real/` folder holds only its README. | Native French tester, Engineering | |
| CAL-02 | The scorer flags at least N known errors, with no `error` status in sentence mode. | Run the scorer over the real fixtures | At least N known errors are flagged. N is not yet set. Write the threshold down before the run. | Engineering | |
| CAL-03 | Mouth diagrams and tips reviewed for accuracy. | `/pronunciation` trap detail for each category | A phonetics-aware French speaker accepts the `altFr` and `altEn` text and the tips. | Native French tester | |
| CAL-04 | Stress and weak forms are never emitted by the scorer on real clips. | Scorer output on CAL-01 clips | No `stress_misplaced` or `weak_forms` result. | Engineering | |

## Core loop screens

| ID | Check | Screen or flow | Expected result | Owner (role) | Tested by / date / result |
|---|---|---|---|---|---|
| CORE-01 | Every visible string comes from `STRINGS` and has a French variant. | All screens, at each level | Mechanical part: the strings test in `src/lib/ui/strings.test.ts` checks that every key has a non-empty `fr`. check-boundaries rule 10 checks French diacritics in JSX text only, so it misses plain English copy. Manual part: at A1-A2, no visible chrome string is English. At B1-B2, chrome is bilingual. At C1, chrome is English with French available in Settings. The lead confirms this rule, since design 02 §1 can be read differently. | Designer, Native French tester | |
| CORE-02 | Onboarding order and resumability. | `/onboarding`: welcome, age gate, consent, mic, goal, placement, result | Each step appears in order. Progress dots show. The flow resumes after a reload. Skip works only where the design allows it. | Designer | |
| CORE-03 | Placement quiz. | Onboarding, placement step | 5 to 6 items. A correct run reaches C1 with `high` confidence. Mic denied or offline shows the self-select path. Speak items do not appear when signed out. | Engineering, Designer | |
| CORE-04 | Shadowing. | `/practice/shadowing` | Speed controls 0.6x, 0.85x and 1x work (`PLAYBACK_RATES` in `src/lib/types.ts`). Karaoke highlight follows the audio, or stays bold with reduced motion. The legend shows on first use. Words are marked only above threshold. One tip shows. Barge-in is off during the model sentence. | Designer, Engineering | |
| CORE-05 | Daily drill. | `/drills` | 120-second budget (`DAILY_DRILL_BUDGET_SEC`). Typed, spoken and self-check input all work. A spoken answer that does not match shows "Tu as dit : …?". Offline self-check works. | Engineering | |
| CORE-06 | Pronunciation trap list and deep links. | `/pronunciation`, and `?trap=h`, `th`, `vowels`, `stress` | Each deep link opens the correct trap. The mouth diagram has `role="img"`, a `<title>` and a long text alternative. | Engineering, Accessibility tester | |
| CORE-07 | Sensitive minimal pair. | `/pronunciation`, the vowels trap | The card shows only "beach /biːtʃ/" as the target. The rude word sits behind the "Entendre la différence" reveal. The reveal is disabled for `ageBand` `15-17`. The sensitive pair is hidden from drills and catalogs by default (SECURITY S16). | Designer, Engineering | |
| CORE-08 | Progress screen. | `/progress` | Streak shows. Weak phonemes appear only after the minimum attempt count is reached. Below it, "Pas encore assez de données" shows. The Franglais phrase bank lists saved cards. Offline shows "Dernière synchro". The 7-day and 30-day toggle is cosmetic in this build (known gap). | Designer | |
| CORE-09 | Settings persist. | `/settings` | Level, captions, playback rate, text-answer mode, `sideCardAutoCollapse` and `silenceAnnouncementsWhileRecording` save. They survive a reload and sign-out. | Engineering | |
| CORE-10 | Text-answer mode on every practice screen. | Shadowing, drills, roleplay, debate, pronunciation | A text input is available on each screen. Pronunciation scoring is labelled as unavailable in text mode, not hidden. | Accessibility tester | |
| CORE-11 | Session exit. | Each live session | The tab bar is hidden. "Terminer" stays in the same place on each session. Escape or back returns to the pre-session state. | Designer | |
| CORE-12 | Home hero card. | `/` for a new user, and for users at A1-A2, B1-B2 and C1 | The hero shows the level-appropriate card. A new user sees "Ta première conversation, 3 minutes" and no streak. A denied microphone changes the hero button. | Designer | |

## Conversation (roleplay and debate)

| ID | Check | Screen or flow | Expected result | Owner (role) | Tested by / date / result |
|---|---|---|---|---|---|
| CONV-01 | Roleplay end to end with a Franglais card. | `/practice/roleplay?scenario=cafe`. Say a French phrase such as "café crème" mid-sentence. | The AI replies in English. The side card appears only after the AI reply starts. It stays visible about 6 s (`SIDE_CARD_COLLAPSE_MS`), then collapses to a "1 mot" pill that stays reachable. It offers Hear, Repeat, Save and "Ce n'est pas du français". | Engineering, Designer | |
| CONV-02 | "Ce n'est pas du français" suppresses the term. | Side card, then reload | The card disappears. The term stays suppressed after reload. | Engineering | |
| CONV-03 | Side-card auto-collapse can be off. | Settings: `sideCardAutoCollapse` off, wait 60 s | The card does not collapse. | Engineering | |
| CONV-04 | The all-French nudge. | Roleplay: speak only French | The nudge appears only when the transcription status is `ok`. It does not appear on `no_speech`. | Engineering | |
| CONV-05 | Debate: live screen with no side cards. | `/practice/debate`, C1 | No hint chips and no live side cards. The timer and End control show. | Engineering | |
| CONV-06 | Debate feedback. | End of a debate, then `/practice/debate?review=<id>` | The tabs are Rephrase, Idioms and Franglais (`src/lib/ui/strings.ts`). Up to 5 rephrases show (`MAX_SHOWN`), with "Voir tout" for more. The notice "Tes réponses sont gardées sur cet appareil" shows. Loading shows "Chargement…". An error shows a retry action. Confirm the error copy in `strings.ts` before the run. | Engineering, Designer | |
| CONV-07 | TTS fallback chain. | Server TTS blocked, then no English voice | Playback falls back to `speechSynthesis`. With no English voice, the app shows text only and does not show an error. | Engineering, Accessibility tester | |
| CONV-08 | Hint chips. | Roleplay: tap "Besoin d'aide ?" and one chip | The chip plays its phrase through `/api/tts?catalog=hint`. The (i) button opens a French explanation sheet. | Engineering | |
| CONV-09 | Silence nudges. | Roleplay, wait without speaking | Nudges appear at about 6 s, 12 s and 25 s (`SILENCE_NUDGE_MS`), and not before. The session pauses at 25 s and does not fail. | Engineering | |
| CONV-10 | Offline mid-call. | Roleplay, turn off the network mid-session | The transcript stays. The message "Connexion perdue. On reprend dès que tu es en ligne." shows. The session is saved. | Engineering | |

## Privacy and consent

| ID | Check | Screen or flow | Expected result | Owner (role) | Tested by / date / result |
|---|---|---|---|---|---|
| PRIV-01 | Age gate blocks under-15s and stores nothing. | Onboarding, age gate, choose the under-15 option | The flow is blocked. In Supabase, `profiles.age_band` stays null and no `privacy_consents` row exists. | Engineering, Legal reviewer | |
| PRIV-02 | Ages 15 to 17. | Onboarding, choose the 15-17 option | `profiles.age_band` is `15-17`. Sensitive reveal stays off (see CORE-07). | Engineering | |
| PRIV-03 | Ages 18 and over. | Onboarding, choose the 18+ option | `profiles.age_band` is `18+`. | Engineering | |
| PRIV-04 | Consent sheet. | Onboarding, consent step | The sheet names OpenAI and Anthropic, or OpenAI alone when `LLM_PROVIDER=openai`. It says audio and transcripts are sent for processing. It does not say data is "never stored". It links to `/privacy`. Accepting writes one `privacy_consents` row with version `2026-11-21`. | Designer, Legal reviewer | |
| PRIV-05 | Consent version gating. | Staging: change `PRIVACY_CONSENT_VERSION` and reload | The microphone is blocked until consent is re-recorded. A `POST /api/transcribe` request without current consent returns `403` (`forbidden`). | Engineering | |
| PRIV-06 | Export end to end. | Privacy page, "Export my data" | A JSON file downloads. The response has `Content-Disposition: attachment; filename="parle-to-speak-export.json"`. It contains profile, sessions, vocabulary, weak phonemes, drill attempts, SRS cards and consent records. It contains no audio. | Engineering | |
| PRIV-07 | Delete end to end. | Privacy page, type `SUPPRIMER`, confirm | The button stays disabled for any other text. On success, no row for that user remains in the eight public tables. **Known gap:** the Supabase Auth user row is not deleted, and the page does not sign out or clear on-device data. Record those as known gaps (SECURITY S15), not as failures, and open a follow-up. | Engineering | |
| PRIV-08 | Delete leaves other users alone. | Two test accounts, delete one | The other account's rows and sign-in stay intact. | Engineering | |
| PRIV-09 | Legal review of the privacy copy. | `strings.ts` keys for consent, processors, export and delete | The legal reviewer approves the copy, or records changes that the team applies. | Legal reviewer | |
| PRIV-10 | Supabase region. | Supabase project settings | The project is in an EU region. | Operator | |
| PRIV-11 | DPAs and zero data retention. | OpenAI and Anthropic account settings | Both DPAs are signed and on file. The zero data retention request to OpenAI is sent where the account is eligible. The outcome is recorded. | Operator | |
| PRIV-12 | Retention job enabled. | Supabase, cron jobs list | The `drill_attempts_retention` job is scheduled (uncomment the `cron.schedule` line in the migration first). In a test project, a row older than 365 days is removed when the job runs. | Operator, Engineering | |
| PRIV-13 | Spoken answers are stored without text. | Drill: answer by voice, then check the table | The `answer` column is null for the spoken attempt. A typed attempt stores its text. The database rejects a spoken attempt that carries text (checked in `rls.sql`). | Engineering | |

## Authentication and guest mode

| ID | Check | Screen or flow | Expected result | Owner (role) | Tested by / date / result |
|---|---|---|---|---|---|
| AUTH-01 | Email one-time-code round trip against a real Supabase project. | `/sign-in` | A code is requested and entered. The session persists across reload. The token refreshes 60 s before expiry (`REFRESH_SKEW_MS`). Sign-out clears the session. | Engineering | |
| AUTH-02 | Wrong or expired code. | `/sign-in` | A text error appears and focus moves to the error banner. The error is not shown in colour alone. | Accessibility tester | |
| AUTH-03 | Accessible sign-in. | `/sign-in` with a password manager and with a screen reader | No puzzle or cognitive test is shown. Pasting the code works. The code field has a label. Engineering confirms the sign-in method, which design 05 leaves open. | Accessibility tester, Engineering | |
| AUTH-04 | Guest scope. | Signed out: drills, shadowing playback, trap library | Drills (typed or self-check) and the trap library work. Shadowing plays with browser TTS. Other features ask for sign-in. The lead confirms the scope, which is still open in PLAN §13. | Designer, Engineering | |
| AUTH-05 | Guest data stays on the device. | Signed-out session, then sign in | Guest data is kept in IndexedDB (`src/client/localStore.ts`) and never sent to the server. Nothing merges into the account until the user confirms. | Engineering | |
| AUTH-06 | Guests get no server TTS. | Signed out, shadowing playback | `GET /api/tts` returns `401` (the guard chain in `src/server/handlers/common.ts`), and the app falls back to `speechSynthesis`. | Engineering | |

## Live API checks

| ID | Check | Screen or flow | Expected result | Owner (role) | Tested by / date / result |
|---|---|---|---|---|---|
| LIVE-01 | Each route works against real providers and a test Supabase project. | `transcribe` (shadowing), `chat` (roleplay), `tts` (shadowing and `timings=1`), `progress` GET and POST, `privacy` export | Each route returns the response shape in its handler. Shadowing sends `language=en` and no `referenceText`. The `codeSwitch` field is set from the learner's last message (`src/server/handlers/chat.ts`). Confirm that matches the product decision for C1 before signing off. Use keys that have a spending limit set in the provider dashboard. | Engineering | |
| LIVE-02 | Clients cannot post a pronunciation report. | `POST /api/progress` with `type: pronunciation_report` | `403` (`forbidden`). The message says `pronunciation_report` is server-produced only. No row is written. | Engineering | |
| LIVE-03 | Daily budget and per-instance limits. | Run 301 transcribe calls in one day as one user | The 301st call returns `429` with a `Retry-After` header. The daily budget for transcribe is 300 (`RATE_LIMITS` in `src/lib/types.ts`). Note: on two server instances, each keeps its own count. | Engineering, Operator | |
| LIVE-04 | Foreign origin. | `POST /api/chat` with an `Origin` header that is not allowlisted, and no token | `403`, not `401`. No `Access-Control-Allow-Origin` header. Known gap: this check covers `POST` only (SECURITY S8). | Engineering | |
| LIVE-05 | Upstream failure. | Force a provider 500 | `502` with a generic message. No key, transcript or upstream body in the response or logs. | Engineering | |
| LIVE-06 | Silence and hallucination guard. | Upload a silent recording, then one with a denylist phrase | Both return `{status: 'no_speech'}`. No progress row is written. | Engineering | |

## Accessibility (WCAG 2.2 AA)

| ID | Check | Screen or flow | Expected result | Owner (role) | Tested by / date / result |
|---|---|---|---|---|---|
| A11Y-01 | Screen reader pass. | Onboarding, roleplay, drill, progress, with VoiceOver on iOS Safari, TalkBack on Android Chrome, and NVDA with Firefox or Chrome | The mic button reads "Appuie pour parler" or "Interrompre" by its label. Status changes are announced once each. Captions are not announced word by word. | Accessibility tester | |
| A11Y-02 | Microphone and screen reader conflict. | Recording with `silenceAnnouncementsWhileRecording` on, then off | With the setting on, no announcements play while recording. With it off, the conflict is observed and noted. | Accessibility tester | |
| A11Y-03 | Word highlights. | Shadowing result | Each word has an `aria-label`, such as "coffee, presque". The glyph is decorative. | Accessibility tester | |
| A11Y-04 | Language switching. | FR chrome with EN practice content | Screen readers switch voice at `lang="fr"` and `lang="en"` boundaries. | Accessibility tester | |
| A11Y-05 | Keyboard-only journey. | Onboarding, roleplay, drill, progress, using the keyboard only | Tab order follows the visual order. Sticky controls do not hide the focused element. Escape closes sheets and returns focus to the trigger. No keyboard trap. | Accessibility tester | |
| A11Y-06 | Zoom and reflow. | 200% and 400% zoom, 320 px width | No horizontal scroll on the core flows. Text stays readable with user spacing overrides. | Accessibility tester | |
| A11Y-07 | Forced colours, colour-blind simulation and greyscale. | Shadowing result under each mode | The OK, warn and error states stay distinct by underline pattern, glyph and label. | Accessibility tester | |
| A11Y-08 | Reduced motion. | OS "reduce motion" setting on | The ring, waveform and card entrance are static or instant, and the karaoke highlight stays bold with an outline. The app honours the OS setting (`prefers-reduced-motion` in `src/styles/`). There is no in-app override in this build. | Accessibility tester | |
| A11Y-09 | Touch targets. | All buttons and chips on a phone | Each target is at least 44 x 44 CSS px (`--touch-min`). The mic control is 80 px (`--touch-mic`). | Designer | |
| A11Y-10 | Automated checks. | axe or Lighthouse on every route | No blocking issue. No contrast script exists in `scripts/`, so check contrast by hand against design 05 §4. | Engineering | |
| A11Y-11 | Dark mode and focus. | `prefers-color-scheme: dark` | Text and focus ring meet the contrast values in design 05 §4. Focus ring is visible. | Designer | |
| A11Y-12 | Users who use assistive technology. | Sessions with Deaf and hard-of-hearing users, blind and low-vision users, users with speech differences, and users with motor impairments | Run through a partner organisation. Do not record a result until the sessions happen. | Accessibility tester | |

## Traceability to PLAN [MANUAL] tags

| PLAN location | Tagged item | MANUAL_QA entry |
|---|---|---|
| §12 risk R1 | Next 15 and `.ts` imports | BLD-05 |
| §12 risk R5 | `typecheck:lib` under TypeScript 5.8 | BLD-04 |
| §7 unit A | Install prompt, iOS instructions, CSP | PWA-01, PWA-02, PWA-03 |
| §7 unit A | `gen-icons` with `sharp` | PWA-08 |
| §7 unit A, S13 | Header check | PWA-06 |
| §7 unit B | Calibration | CAL-01, CAL-02 |
| §7 unit H1 | OTP round trip | AUTH-01 |
| §7 unit H2 | Each screen; screen reader; offline drills; delete and export | CORE-01 to CORE-12; A11Y-01; PWA-05; PRIV-06, PRIV-07 |
| §7 unit H3 | Roleplay with Franglais card; debate feedback; TTS fallback | CONV-01, CONV-06, CONV-07 |
| §7 unit I, §12 R6 | Legal review of privacy copy | PRIV-09 |
| §10 gate | Install, type check, build and precache, Lighthouse, live API checks, calibration, accessibility pass | BLD-01, BLD-03, BLD-02, PWA-04, LIVE-01, CAL-02, A11Y-01 |

Rows beyond the plan's [MANUAL] tags (PWA-05, AUTH-03 to AUTH-06, PRIV-01 to PRIV-05, PRIV-08, PRIV-10 to PRIV-13, BLD-06, and the design-derived CORE, CONV and A11Y checks) come from `docs/design/` and the review. They are not [MANUAL] tags in PLAN.
