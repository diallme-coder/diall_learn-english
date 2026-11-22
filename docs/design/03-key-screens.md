# 03 - Key Screens (wireframe specs)

Frame: 390 x 844 portrait. ASCII only; real layout uses tokens from `src/styles/tokens.css`. Copy shown is the A1-A2 French variant unless stated. Component class names refer to `globals.css`.

## 0. Shared conventions

**Global state matrix.** Every voice screen implements these seven states. Screen sections below only describe what differs.

| State | Mic button | Status line (aria-live polite) | Visual | Audio |
|---|---|---|---|---|
| idle | Coral, label "Appuie pour parler" | Prompt to act | Static | none |
| listening | Pulsing ring + waveform bars; label "Je t'écoute" | "Je t'écoute" | Ring pulse (static ring if reduced motion) | Soft start earcon (optional) |
| thinking | Mic disabled, 3 dots | "Je réfléchis…" | Dots; after 3 s add "Un instant" | none |
| speaking | Mic shows "Interrompre" (barge-in) | "Alex parle" | Caption streams in AI bubble | AI audio |
| error | Mic returns to idle, inline banner above | Specific message (see 04 ladder) | Banner with icon + Retry | none |
| offline | Mic disabled for AI modes; banner "Hors ligne" | "Tu es hors ligne" | Offline banner, cached content stays usable | none |
| mic-denied | Mic replaced by "Autoriser le micro" | "Micro bloqué" | Instruction panel + text fallback | none |

**Offline behaviour.** Drills and saved Shadowing sets (pre-cached) work offline in self-assessment mode (no scoring). Roleplay, Debate, and live scoring need a connection.

**Mic-denied panel (shared).**

```
┌──────────────────────────────────────┐
│  (mic with slash icon)               │
│  Le micro est bloqué                 │
│  Parle-to-Speak a besoin du micro    │
│  pour t'écouter.                     │
│  [Comment l'activer]  (steps sheet)  │
│  [Continuer à l'écrit]  (text mode)  │
└──────────────────────────────────────┘
```
Text mode: user types answers; pronunciation features are hidden and labelled "Nécessite le micro".

---

## 1. Home `/`

Purpose: one obvious next action, today's streak, and the day's drill.

```
┌──────────────────────────────────────┐
│ Bonjour, Camille            (avatar) │  <- avatar -> /settings
│ [B1 ▪ Intermédiaire]  🔥 4 jours     │  .level-badge, streak (icon + text)
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ CONTINUER                        │ │  hero card (primary action)
│ │ Jeu de rôle · Au café            │ │
│ │ Commande un café avec Alex       │ │
│ │ [ ● Reprendre ]  (mic-style btn) │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Défi du jour · 2 min             │ │  -> /drills
│ │ "J'ai 25 ans" → ?                │ │
│ │ [ Commencer ]                    │ │
│ └──────────────────────────────────┘ │
│ Ton point faible : TH /θ/  [Travailler]│ -> /pronunciation?trap=th
│                                      │
│ [Accueil][Pratiquer][Prononcer][Progrès]│
└──────────────────────────────────────┘
```

- Hero card content adapts by level: A1-A2 shows Shadowing set; B1-B2 shows last roleplay scenario; C1 shows a debate topic.
- Empty state (new user after onboarding): hero is "Ta première conversation, 3 minutes", no streak shown.
- Offline: hero card shows "Hors ligne : le défi du jour est disponible"; AI cards dim with explanation.
- Mic-denied: hero button changes to "Autoriser le micro" before starting any session.

## 2. Onboarding and level placement `/onboarding`

Five steps, each one decision, progress dots at top, skip allowed where noted. Chrome starts in French (safe default for the audience).

```
Step 1  Welcome            Step 2  Micro              Step 3  Goal
┌──────────────────┐      ┌──────────────────┐       ┌──────────────────┐
│ Parle-to-Speak   │      │ (mic illustration)│       │ Pourquoi l'anglais?│
│ Parle anglais    │      │ Pour parler, il   │       │ ( ) Travail        │
│ sans avoir peur  │      │ faut le micro.    │       │ ( ) Voyage         │
│ de te tromper.   │      │ Ton audio n'est   │       │ ( ) Examen         │
│                  │      │ pas partagé. *    │       │ ( ) Plaisir        │
│ [Commencer]      │      │ [Autoriser]       │       │ [Continuer]        │
│                  │      │ [Plus tard]       │       │                    │
└──────────────────┘      └──────────────────┘       └──────────────────┘
* exact privacy statement to be confirmed by product/legal.

Step 4  Placement (2 min, spoken)           Step 5  Result
┌──────────────────────────────┐            ┌──────────────────────────────┐
│ Question 2 / 5                │            │ Ton niveau de départ         │
│ Dis en anglais :              │            │ [ B1 ] Intermédiaire         │
│ "Where do you live?"          │            │ On commence par : Jeu de rôle│
│ (FR: Où habites-tu ?)         │            │ [C'est parti]                │
│        ( ● mic )              │            │ [Changer de niveau]          │
│ [Je ne sais pas]  [Passer]    │            └──────────────────────────────┘
└──────────────────────────────┘
```

- Placement is 5 short spoken prompts of rising difficulty, plus "Choisir mon niveau moi-même" shortcut on step 4 for anyone who prefers it. Result is a suggestion, always editable.
- "Je ne sais pas" is a valid answer, scored as a lower level signal, never as failure.
- Value before permission: step 2 explains why before the browser prompt. If the user taps "Plus tard", skip to a text-only placement (self-select level) and ask again at first session.
- States: listening, thinking, speaking per global matrix; mic-denied jumps to self-select level; offline allows self-select only.

## 3. Shadowing `/practice/shadowing` (A1-A2)

```
┌──────────────────────────────────────┐
│ ✕ Terminer         Phrase 3 / 8      │
│ ▓▓▓▓▓░░░░░░░                         │
│                                      │
│  "I'd like a coffee, please."        │  large text, words as .word spans
│  Je voudrais un café, s'il vous plaît│  French translation, always visible
│  [🔊 0.85x]  [🐢 0.6x]  [👁 Voir/Cacher]│  replay controls
│                                      │
│  Ton essai :                         │
│  I'd like a ⟨cofee⟩ please           │  .word.ok / .warn / .err
│  ✓ I'd  ✓ like  ✓ a  ~ coffee  ✓ please│
│                                      │
│  (!) coffee : le "o" est plus ouvert │  one tip only (principle 4)
│  [Écoute]  [Réessayer]  [Suivant →]  │
│                                      │
│          ( ● Appuie pour parler )    │
└──────────────────────────────────────┘
```

Flow: app says the sentence at 0.85x with captions > user taps mic (push-to-talk default for A1-A2) > thinking > word-level result > user retries or advances.

- Highlight legend, one-line, shown on first use: "Souligné ondulé = presque ; souligné double = à travailler" (see 04 for pattern definitions).
- States specifics: **speaking** = model audio plays; words highlight karaoke-style (reduced motion: no animation, current word bold). **error** = "Je n'ai pas bien entendu" + Retry; never marks words red when audio failed. **offline** = sentences from cached set, "Mode écoute seule : pas de score hors ligne".
- Result is not shown as a percentage by default; words are marked only above the confidence threshold (principle 5).
- After 3 failed tries on the same word: offer "Voir l'astuce de bouche" linking to `/pronunciation?trap=...`.

## 4. Roleplay `/practice/roleplay` (B1-B2) with hint chips and Franglais side-card

```
┌──────────────────────────────────────┐
│ ✕ Terminer   Au café · Alex   [💬 Sous-titres]│
│                                      │
│  Alex   ┌──────────────────────────┐ │
│         │ Hi! What can I get you?  │ │  .transcript-bubble (ai)
│         └──────────────────────────┘ │
│                    ┌───────────────┐ │
│                    │ I want a ⟨café│ │  user bubble, FR segment marked
│                    │ crème⟩ please │ │  with "FR" tag + dotted underline
│                    └───────────────┘ │
│ ┌ Franglais ───────────────────────┐ │  .side-card (subtle, dismissable)
│ │ Tu as dit « café crème »         │ │
│ │ En anglais, dis : a flat white   │ │
│ │ [🔊] [Répéter] [Garder] [✕]      │ │
│ └──────────────────────────────────┘ │
│  Alex   ┌──────────────────────────┐ │
│         │ Sure, one flat white!    │ │
│         └──────────────────────────┘ │
│                                      │
│ Suggestions :                        │
│ [Can I have…?] [I'd like…] [How much?]│ .chip x3 (tap = say aloud model)
│ (i) Explication en français          │ tap = bottom sheet
│            ( ● Appuie / maintiens )  │
└──────────────────────────────────────┘
```

Behaviour:
- 3 starter chips shown at start of each turn when idle > 4 s or on tap of "Besoin d'aide ?". Chip tap plays the phrase, then the user repeats it; chips refresh each turn. Chips never auto-fill speech.
- French explanation: tap (i) or long-press chip opens a bottom sheet with a short French note (what it means, when to use it).
- **Franglais side-card**: appears after the AI starts answering in English (never before), anchored under the user's bubble, 6 s visible then collapses to a small "1 mot" pill (not auto-removed; reachable later). Does not block the mic. Details in 04.
- Bilingual chrome (B1-B2): button labels "Terminer · End", status lines in French with English secondary in the top bar.
- States: **listening** = hands-free default at B1-B2 with a visible mic state; **thinking** = typing dots bubble from Alex; **speaking** = AI bubble streams captions, mic label "Interrompre · Interrupt"; **error** / **offline** / **mic-denied** per global matrix. Offline mid-call: keep transcript, show "Connexion perdue. On reprend dès que tu es en ligne" and save session.
- Empty state (scenario start): Alex speaks first with the opening line; 3 chips visible at once.

## 5. Debate `/practice/debate` (C1) and post-call feedback

Live screen (English chrome):

```
┌──────────────────────────────────────┐
│ ✕ End         Debate: Remote work    │
│ 03:42                    [CC on]     │
│  AI  "Honestly, I'd argue the office │
│       is overrated. Why put up with  │
│       a commute?"                    │
│  You (live captions)                 │
│  "Well, I can't really figure out…"  │
│  ~~~~~~~ waveform ~~~~~~~            │
│  [ Hands-free ● ]   [ Mute ]  [ End ]│
└──────────────────────────────────────┘
```

No hint chips, no French. Full-speed audio. Franglais still caught and shown only in post-call review (no side-card live, per C1 "unscripted"; configurable in Settings).

Post-call feedback `?review=<id>`:

```
┌──────────────────────────────────────┐
│ Call review · 8 min                  │
│ Highlights (3)  |  Rephrase (5)  |  Idioms (2)│ tabs
│ ──────────────────────────────────── │
│ You said                             │
│ "I think that remote work is more good │
│  for the families."                  │
│ A native might say                   │
│ "Remote work is better for families."│
│ Why: "more good" → "better"; no article│
│ [🔊 Hear it]  [Say it]  [Save]       │
│ ──────────────────────────────────── │
│ Phrasal verbs you used: figure out ✓ │
│ Try next time: put up with, run into │
└──────────────────────────────────────┘
```

- Maximum 5 rephrases shown by default (principle 4); "See all" expands.
- "Say it" opens a mini shadowing of the native phrasing.
- States: review **thinking** = skeleton cards with "Preparing your review (about a minute)" (target to be measured); **error** = "Review failed - Retry; your recording is kept"; **offline** = previously loaded reviews readable, new one queued.

## 6. Pronunciation fixer `/pronunciation`

List then detail. Four traps, one card each.

```
List                                 Detail: TH
┌──────────────────────────────┐    ┌──────────────────────────────┐
│ Les pièges français          │    │ ‹ TH  /θ/ /ð/                 │
│ [H  hungry / angry      ›]   │    │ think ≠ sink      this ≠ zis  │
│ [TH think / this        ›]   │    │ ┌──────────────────────────┐ │
│ [Voyelles ship / sheep  ›]   │    │ │  MOUTH DIAGRAM (side view)│ │
│ [Accent et rythme       ›]   │    │ │      ___                  │ │
│ Ton point faible : TH        │    │ │   .-'   '-.  ← langue entre│ │
└──────────────────────────────┘    │ │  | tongue→(  ) les dents  │ │
                                    │ │   '-._ _.-'               │ │
                                    │ └──────────────────────────┘ │
                                    │ Astuce : place le bout de la  │
                                    │ langue entre les dents et     │
                                    │ souffle, sans voix pour /θ/.  │
                                    │ [🔊 think] [🔊 sink] [● Essaie]│
                                    │ Résultat : think  ~ (presque) │
                                    └──────────────────────────────┘
```

Mouth diagram spec: simple side-view (sagittal) line drawing, 3 parts labelled in French (langue, dents, lèvres), a highlighted articulator (accent colour) plus a small arrow for movement, plus text alternative describing it. One diagram per sound; neutral, non-photographic.

Per-trap content:
- **H aspiré vs muet**: hungry / angry, hair / air. Tip FR: "Le H anglais se prononce : souffle léger depuis la gorge, comme sur une vitre qu'on embue. En français il est muet." Diagram: open glottis, air arrow. Tip emphasises not dropping H ("'ungry").
- **TH /θ/ /ð/**: think not sink; this not zis. Tongue tip between teeth; voiceless /θ/ vs voiced /ð/ (feel vibration, finger on throat).
- **Voyelles courtes / longues**: ship / sheep, live / leave, and the sensitive pair beach / bitch. Presented as minimal pair cards. Tip FR: "/ɪ/ court et détendu ; /iː/ long, lèvres étirées." Duration shown as short bar vs long bar. **Sensitive pair handling**: the card shows "beach /biːtʃ/" as the target. The second word is hidden behind a tap-to-reveal note: "Attention : un /ɪ/ trop court peut changer le mot en une insulte. Entraîne-toi sur beach avec le /iː/ long." The rude word has no audio by default (opt-in "Entendre la différence" with an explicit tap). Wording is neutral and non-moralising, no jokes.
- **Accent et rythme**: pho-TO-gra-phy vs PHO-to-graph. Show syllables as beats: big dot on stressed syllable, small on others; contrast French syllable-timed (even dots) vs English stress-timed (uneven). Interactive: tap-along metronome. Reduced motion: static dots.

States: **listening/thinking/speaking** per matrix; practice scoring shows word-level markers only above confidence threshold; **error** = "Réessaie" ladder; **offline** = tips and diagrams readable (cached), "Essaie" disabled; **mic-denied** = tips readable, "Essaie" replaced by panel.

## 7. Micro-drill `/drills`

Two minutes, 6 to 8 items, one decision per screen.

```
┌──────────────────────────────────────┐
│ ✕       Défi du jour       ▓▓▓░░ 3/7 │
│                                      │
│  En français :                       │
│  « J'ai 25 ans. »                    │
│                                      │
│  Dis-le en anglais.                  │
│        ( ● Appuie pour parler )      │
│  [Je ne sais pas]                    │
└──────────────────────────────────────┘

After answer (correct):                After answer (word-for-word trap):
┌────────────────────────────┐         ┌────────────────────────────────┐
│ ✓ I am 25.                 │         │ ✗ I have 25 years.             │
│ Bien joué !                │         │ Piège : on ne "possède" pas    │
│ [Suivant]                  │         │ son âge en anglais.            │
└────────────────────────────┘         │ ✓ I am 25.   [🔊] [Répète]     │
                                       └────────────────────────────────┘
```

Items include: J'ai 25 ans > I am 25; Je suis d'accord > I agree; J'habite ici depuis 3 ans > I have lived here for 3 years. Feedback is a "Piège / Trap" card showing the literal-trap English crossed out with a text label (not colour only), then the natural form.

- End screen: "7 / 7 - 2 min" with streak update, and "Garder 2 phrases" to phrase bank.
- States: **speaking** = model reads the natural answer; **offline** = fully usable with self-check ("Je l'ai dit" / "Pas sûr") and no scoring; **mic-denied** = type answer option.
- Spoken answer is accepted as long as meaning is equivalent; the ASR transcript is shown for confirmation if confidence is low ("Tu as dit : …?").

## 8. Progress and weak phonemes `/progress`

```
┌──────────────────────────────────────┐
│ Progrès                [7 j | 30 j]  │
│ 🔥 Série 4 jours   ⏱ 38 min parlées  │
│                                      │
│ Phonèmes à travailler                │
│ /θ/ th   ▓▓▓▓░░░░░░  fragile         │  bar + label + icon (not colour alone)
│ /h/      ▓▓▓▓▓▓░░░░  en progrès      │
│ /ɪ/ ~ /iː/ ▓▓▓▓▓▓▓░░░ solide        │
│ [Travailler /θ/ →]                   │
│                                      │
│ Mes phrases Franglais (12)           │
│ embouteillage → traffic jam  [🔊]    │
│ café crème → flat white      [🔊]    │
│ [Réviser (5 min)]                    │
└──────────────────────────────────────┘
```

- Metrics shown are time spoken and attempts; no invented scores. Phoneme labels are relative buckets (fragile / en progrès / solide), computed only from enough attempts. Below the minimum attempts: "Pas encore assez de données".
- Empty state: "Parle un peu et tes points faibles apparaîtront ici."
- States: **offline** = last synced data with "Dernière synchro : …"; **error** = "Impossible de charger - Réessayer".
