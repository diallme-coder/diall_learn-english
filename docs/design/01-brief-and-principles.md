# 01 - Brief and Principles

Status: draft for sign-off. Nothing here is validated research; personas and targets are hypotheses.

## 1. Project overview

**Parle-to-Speak** is a voice-first, mobile-first PWA that helps French speakers speak English out loud. Stack context: Next.js (App Router), Whisper / Realtime API for speech, Supabase for auth and data.

## 2. Problem statement

French adults often study English for years yet freeze when speaking. Hypothesised causes, to be tested:

- Fear of the missing word stops the sentence (the "blank" moment).
- Word-for-word translation from French produces unnatural English.
- A few predictable sound traps (H, TH, vowel length, stress and rhythm) hurt intelligibility.
- Most apps train reading and tapping, not speaking aloud.

## 3. Audience (hypothesis personas)

**Primary (H1) - "Camille, 34, intermediate and hesitant".** French office worker, B1. Understands more than she says. Practises in short slots (commute, lunch, evening) on a phone, often with one earbud, sometimes where she cannot speak loudly. Wants to stop freezing in meetings and calls. Fears sounding foolish, so private practice matters.

**Secondary (H2) - "Mehdi, 22, beginner".** A2 student. Needs French support everywhere, slow audio, tiny goals.

**Secondary (H3) - "Hélène, 48, advanced and polishing".** C1. Wants native phrasing, idioms, phrasal verbs, debate at full speed.

These are assumptions to check in interviews before build decisions harden.

## 4. Product scope (from spec)

1. **Franglais safety net**: French mid-sentence is accepted; AI replies in English and shows a side-card with the English equivalent.
2. **Pronunciation fixer**: H aspire vs muet, TH, short vs long vowels, word stress and rhythm; French mouth-placement tips with a mouth diagram.
3. **Levels**: A1-A2 Guided Shadowing; B1-B2 Guided Roleplay; C1 Unscripted Debate and Idioms with post-call feedback.
4. **"Stop Translating Word-for-Word"** two-minute daily micro-drills.

UI chrome language: French (A1-A2), bilingual (B1-B2), English (C1).

## 5. Out of scope for design phase

App logic, ASR/LLM prompts, content authoring at scale, payments, social features.

## 6. Constraints

- Mobile-first, one-handed, portrait. PWA: installable, offline shell, graceful offline states.
- Microphone permission is required for the core loop; denial must have a full fallback path.
- ASR confidence is imperfect, especially for accented speech and code-switching; UI must not over-claim.
- Latency budget is a design input: aim for first audio of the AI reply within roughly 1 second after user stops (target, to be measured).
- WCAG 2.2 AA (see 05).
- Pronunciation content includes one sensitive minimal pair (beach/bitch); handle tastefully (see 03 and 04).

## 7. Design principles (resolve trade-offs)

| # | Principle | When two goods collide, we choose... |
|---|---|---|
| 1 | **Voice first, screen second** | Speaking time over reading time. Screen text supports the ear; every flow works eyes-off for the core loop where feasible. |
| 2 | **Flow over correctness** | Keeping the conversation alive beats fixing an error now. No live interruption for mistakes; corrections wait in side-cards and post-call review. |
| 3 | **French is a bridge, not a failure** | Rewarding a French fallback ("tu as trouvé une solution") over penalising it. Code-switching never counts as an error in scoring. |
| 4 | **One fix at a time** | A single, actionable correction per turn over exhaustive feedback. The rest goes to review. |
| 5 | **Honest uncertainty** | Saying less when the ASR is unsure ("Je n'en suis pas sûr") over confidently marking a user wrong. Low-confidence words are never red. |
| 6 | **Never colour alone** | Pattern, underline, icon and text label alongside yellow/red, even if it looks busier. |

Corollary rules:

- Chrome language follows level (FR / FR+EN / EN) but practice content is always English. French appears as scaffolding: translation under sentence, tap-to-reveal explanations, mouth tips.
- Tone: warm, encouraging, never infantilising; tutoiement vs vouvoiement - propose **tu** (open question, see below).

## 8. Success criteria

Targets are hypotheses to be set after baseline measurement; no benchmarks are claimed.

Behavioural (instrumentable):
- Share of new users who complete a first spoken turn in session one.
- Median speaking time per session vs listening/reading time (speaking should dominate).
- Day-7 and day-30 return for users who completed one micro-drill.
- Franglais side-card: share of cards followed by the user re-saying the English phrase.
- Pronunciation: improvement in same-phoneme accuracy across sessions for the same user.

Qualitative:
- Users say they felt safe to try without being judged (post-session one-question pulse).
- Usability tests: participants can start a roleplay in under three taps from Home without help.
- Accessibility: zero blocking issues in the test plan in 05.

## 9. Deliverables

01 brief and principles; 02 information architecture; 03 key screens; 04 voice and feedback UX; 05 accessibility; `src/styles/tokens.css`; `src/styles/globals.css`.

## 10. Open questions

See bottom of 04 and the final handoff report; summarised there to keep one home per question.
