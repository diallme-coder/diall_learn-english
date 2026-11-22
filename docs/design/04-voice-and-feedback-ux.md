# 04 - Voice and Feedback UX

Persona of the AI: a friendly, named English-speaking character per scenario (e.g. "Alex" at the café). It says it is an AI if sincerely asked. Warm, concise, never sarcastic about errors.

## 1. Turn-taking modes

| Mode | Default for | Behaviour | Why |
|---|---|---|---|
| **Push-to-talk (tap to start, tap to stop)** | A1-A2 (Shadowing, Drills, Pronunciation) | User controls when audio is captured; no mis-triggers from hesitation | Beginners pause mid-word; short, bounded utterances score better |
| **Hold-to-talk (optional)** | Setting | Press and hold, release to send | Familiar for some; accessibility alternative to toggle |
| **Hands-free (voice activity detection)** | B1-B2 Roleplay, C1 Debate | Mic opens after AI finishes; end-of-turn by silence | Conversation realism |

Rules:
- Always show mic state, even hands-free (listening ring + text). Never listen invisibly.
- Hands-free can be paused with one tap ("Pause"); push-to-talk is selectable in Settings at any level, because noisy places and shy speakers need it.
- Switch modes mid-session without losing context.

## 2. Silence and end-of-turn timeouts

Values are starting hypotheses to tune in testing.

| Situation | Hands-free | Push-to-talk |
|---|---|---|
| User still talking, brief pause | Wait ~1.2 s of silence at A1-A2/B1, ~0.9 s at B2/C1 before ending the turn | Not applicable (user ends it) |
| Hesitation ("uh... euh...") | Filler sounds do not end the turn; extend wait by ~1 s when trailing filler detected | n/a |
| No speech after AI prompt | At ~6 s: gentle nudge ("Prends ton temps"); at ~12 s: offer help (chips, repeat); at ~25 s: pause listening and show "Reprendre" | Show chips after ~6 s idle |
| Very long turn | Soft cap near 45 s: AI backchannels or user taps "Fini" | Soft cap with visual timer |

Design intent: thinking time is normal for learners; the app should feel patient, never impatient. Longer silences at lower levels.

## 3. Barge-in

- User speaking while AI talks stops the AI within a short fade (target under 300 ms; to measure) and starts listening; the AI's captions truncate with "…".
- Mic button during AI speech reads "Interrompre / Interrupt"; tapping works the same.
- Guard against echo: with speaker output and no headphones, barge-in uses a higher voice threshold; suggest headphones once ("Avec des écouteurs, c'est plus fluide").
- In Shadowing, barge-in is disabled during the model sentence (the user is supposed to listen first); mic stays inactive until the model finishes.
- After a barge-in the AI does not restate everything; it answers the new input.

## 4. Code-switch (Franglais) detection UX

Goal: the user can say a French word mid-sentence and never feel stuck.

1. **Detect**: transcription tags language segments (EN / FR). A French segment inside an English utterance triggers the safety net.
2. **Respond first, annotate second**: the AI replies in English using the intended meaning immediately, naturally including the English term when it fits ("Ah, the traffic jam? That sounds awful.") so flow is preserved (principle 2).
3. **Annotate**: a side-card appears (see section 5).
4. **Mark in transcript**: French segment is tagged with a small "FR" label and a dotted underline (not colour alone), so the user sees what they said.
5. **Uncertainty**: if language ID or the intended meaning is unsure, the AI asks a short English check ("Do you mean 'traffic jam'?") rather than showing a card with a guess. Sentence-level French (entire turn in French) triggers the gentle nudge in section 7, step 3.
6. **No penalty**: code-switches are excluded from error scoring; they feed the Franglais phrase bank instead.
7. **Rare-case rules**: proper nouns, borrowed words (e.g. "croissant") and French names are not flagged as code-switching. Provide "Ce n'est pas du français" correction on the card.

## 5. Side-card behaviour

Format (French, A1-A2 and B1-B2): « Tu as dit **embouteillage** · En anglais, dis : **traffic jam** ». English variant (C1 post-call): "You said 'embouteillage' -> in English: traffic jam".

| Aspect | Rule |
|---|---|
| Timing | Appears after the AI begins its English reply; never interrupts the user's speech or the AI's audio |
| Placement | Inline under the user's bubble (not a modal, not a toast over the mic) |
| Persistence | Visible ~6 s; then collapses to a "1 mot" pill; stays reachable until session end |
| Actions | Hear (TTS), Repeat (mini shadow of the English phrase, optional), Save to phrase bank, Dismiss |
| Stacking | Max 2 cards visible; others queue in the pill ("+2") |
| Audio | Not spoken automatically; tap to hear (avoid talking over the conversation) |
| Screen readers | `role="status"` politely announced after the AI reply finishes; actions are buttons |
| C1 | Off live by default; shown in post-call feedback |

Repeat action, if used: the AI's next turn waits; after the repeat, conversation resumes with a single line ("Great, let's go on.").

## 6. Highlight system (shadowing and pronunciation)

Three outcomes per word. Colour is never the only signal (principle 6).

| Outcome | Colour | Non-colour cue (pattern) | Icon / label | Meaning |
|---|---|---|---|---|
| OK | No fill (or neutral) | Thin dotted underline | check "Bien" | Clear and intelligible |
| Warn | Yellow | Wavy underline | tilde "Presque" | Understandable, one sound off |
| Error | Red | Double underline + bold | cross "À retravailler" | Likely misheard or wrong sound |

Rules:
- Show a legend at first use and in help.
- Text labels are available to screen readers on each word (`aria-label` e.g. "coffee, presque").
- Only mark words above the confidence threshold. Below it, show a neutral "Pas sûr" (dashed outline), never red.
- Show at most one coaching tip per attempt, tied to the most important word.
- Wording is about the sound, not the person: "le TH est proche" rather than "tu as faux".

## 7. Error recovery ladder

Applies to speech errors (no input, no match, low confidence, out-of-scope) and system errors. Each rung adds information (never repeat the same prompt twice).

**Speech ladder (hands-free and push-to-talk)**

1. First failure: rephrase with context. FR: « Je n'ai pas bien entendu. Tu peux répéter ? » EN: "Sorry, I didn't catch that. Could you say it again?"
2. Second failure: offer constrained help. Show hint chips or suggested starters; slower AI prompt. FR: « Essaie avec l'une de ces phrases. » EN: "Try one of these."
3. Third failure: offer an exit or alternate input: type the answer, skip the sentence, switch to push-to-talk, check the microphone. FR: « On essaie autrement ? [Écrire] [Passer] [Tester le micro] ».
4. If the user speaks only French (not a single word): the AI says in English "I'd love to hear that in English! Try just the first few words," offers a chip, and at A1-A2 displays the French translation as a model.

**System ladder**

| Failure | Message (FR) | Message (EN) | Action |
|---|---|---|---|
| Mic denied | « Le micro est bloqué. » | "The microphone is blocked." | Steps sheet + text mode |
| Mic in use / not found | « Je ne trouve pas ton micro. » | "I can't find your microphone." | Device picker, retry |
| Noisy environment (high noise, low SNR) | « Il y a beaucoup de bruit. » | "It's quite noisy here." | Suggest push-to-talk or headphones |
| Network slow (>3 s thinking) | « Un instant… » then « La connexion est lente. » | "One moment…" then "The connection is slow." | Keep mic idle, show retry |
| Offline | « Tu es hors ligne. » | "You're offline." | Offline-capable content link |
| Server error | « Oups, un souci de notre côté. » | "Something went wrong on our side." | Retry, session saved |
| ASR low confidence on word | « Pas sûr de ce mot. » | "Not sure about that word." | Neutral outline, no scoring |

Errors always: say what happened, say whose side it is when it is the system's, offer one primary action, and keep the user's progress.

## 8. Latency and feedback timing

- Acknowledge user input visually immediately (listening ring responds within ~100 ms; target).
- Thinking state at once; after ~3 s add reassurance; after ~8 s offer retry.
- Earcons (optional, off by default if the user has "reduce sound" on): soft start-listening and done-listening tones. All state also visible and in text.
- Haptics (mobile): light tick on mic start and stop, where supported.

## 9. Captions and transcripts

All AI speech is captioned (streaming) and user speech shows a live transcript. Captions toggle persists per user; at A1-A2 captions are on and not removable in practice sessions without confirmation (they support learning), but can be hidden in Settings for accessibility-neutral reasons. Details in 05.

## 10. Microcopy bank

| Moment | French (A1-A2) | Bilingual (B1-B2) | English (C1) |
|---|---|---|---|
| Mic idle | Appuie pour parler | Appuie pour parler · Tap to talk | Tap to talk |
| Listening | Je t'écoute | Je t'écoute · Listening | Listening |
| Thinking | Je réfléchis… | Je réfléchis… · Thinking | Thinking… |
| AI speaking | Alex parle | Alex parle · Alex is talking | Alex is speaking |
| Interrupt | Interrompre | Interrompre · Interrupt | Interrupt |
| Good | Bien joué ! | Bien joué ! · Nice one | Nice. |
| Almost | Presque ! | Presque ! · Almost | Almost there. |
| Retry | Réessayer | Réessayer · Try again | Try again |
| Franglais card title | Tu as dit « embouteillage » | Tu as dit · You said "embouteillage" | You said "embouteillage" |
| Franglais card body | En anglais, dis : traffic jam | En anglais · In English: traffic jam | In English, say: traffic jam |
| Hint button | Besoin d'aide ? | Besoin d'aide ? · Need a hint? | Hint |
| Trap card (drill) | Piège : on ne « possède » pas son âge | Piège · Trap: you are 25, you don't have 25 | Trap: literal translation |
| Offline | Tu es hors ligne | Hors ligne · Offline | You're offline |
| Mic blocked | Le micro est bloqué | Micro bloqué · Mic blocked | Microphone blocked |
| Silence nudge | Prends ton temps | Prends ton temps · Take your time | Take your time. |
| End session | Terminer | Terminer · End | End |
| Review title | Ton bilan | Ton bilan · Your review | Call review |
| Native phrasing | Un natif dirait | Un natif dirait · A native might say | A native might say |

Style rules: tutoiement by default (to confirm); short sentences; no sarcasm; praise the effort and the attempt; use "Presque" rather than "Faux"; no exclamation overload (one per message maximum); French typography (space before ? ! : ; with narrow non-breaking space) in the French strings.

## 11. Open questions (voice and feedback)

- Hands-free default at B1 or push-to-talk until the user opts in?
- Show side-card live at C1 or only post-call?
- Should the AI ever offer the English word aloud right after a French fallback, or only in the card?
- Which end-of-turn silence values feel right for French speakers? Needs usability testing.
