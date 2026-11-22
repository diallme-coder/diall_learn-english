# 02 - Information Architecture

## 1. Model

Level drives three things: **which practice mode is the default**, **chrome language**, and **how much French scaffolding is shown**. Level is a setting, not a gate: users can open any mode (e.g. a B1 user can try Shadowing).

| Level | Default mode | Chrome | French scaffolding |
|---|---|---|---|
| A1-A2 | Shadowing | French | Translation under every sentence, always on |
| B1-B2 | Roleplay | Bilingual (FR primary label, EN secondary) | Tap to reveal |
| C1 | Debate and Idioms | English | Off by default; available in Settings |

## 2. Sitemap

```
Parle-to-Speak
├── /                         Home (today's plan: drill + continue mode)
├── /onboarding               Welcome > mic permission > goal > level placement
├── /practice
│   ├── /practice/shadowing   A1-A2 Guided Shadowing
│   ├── /practice/roleplay    B1-B2 scenario picker + live roleplay
│   └── /practice/debate      C1 topic picker + live debate + feedback
├── /drills                   2-minute "Stop Translating Word-for-Word"
├── /pronunciation            Pronunciation fixer (traps library)
├── /progress                 Streak, weak phonemes, Franglais phrase bank
└── /settings                 Level, language, audio, captions, privacy
```

## 3. Navigation model

- **Mobile (primary): bottom tab bar, 4 tabs**: Accueil / Home, Pratiquer / Practice, Prononcer / Pronounce, Progrès / Progress. Settings via avatar icon in Home header (not a tab; rarely used).
- **Drills** are reached from the Home hero card ("Défi du jour, 2 min") and from Practice; not a tab, to keep four tabs (Hick's law, thumb reach).
- **Live sessions (shadowing, roleplay, debate) are full-screen, tab bar hidden**, with a single persistent "Terminer / End" control and a back affordance. Rationale: focus, and avoids accidental tab changes mid-call.
- **Desktop / tablet**: same four destinations as a left rail; sessions centred at max 480px content width.
- Deep links are supported for every route; a session route without mic permission redirects to its pre-session state, not to onboarding.

## 4. Routes (Next.js App Router)

| Route | Segment file | Purpose | Notes |
|---|---|---|---|
| `/` | `app/page.tsx` | Home | Redirects to `/onboarding` if no profile |
| `/onboarding` | `app/onboarding/page.tsx` | First run | Steps held in client state, resumable |
| `/practice` | `app/practice/page.tsx` | Mode chooser | Level-recommended mode on top |
| `/practice/shadowing` | `.../shadowing/page.tsx` | Sentence set picker + session | `?set=` optional |
| `/practice/roleplay` | `.../roleplay/page.tsx` | Scenario picker (café, entretien, service client, small talk) | `?scenario=` starts session |
| `/practice/debate` | `.../debate/page.tsx` | Topic picker + session | Post-call feedback at `?review=<id>` |
| `/drills` | `app/drills/page.tsx` | Daily micro-drill runner | Works offline with cached drill set |
| `/pronunciation` | `app/pronunciation/page.tsx` | Trap list | `?trap=h|th|vowels|stress` deep link |
| `/progress` | `app/progress/page.tsx` | Progress and weak phonemes | Includes Franglais phrase bank |
| `/settings` | `app/settings/page.tsx` | Preferences | Level change, captions, privacy |

Suggested route groups: `(app)` for tabbed pages, `(session)` for full-screen session layouts, `(onboarding)` for the first-run layout.

## 5. Content model (design-level)

- **Level**: A1-A2 | B1-B2 | C1.
- **Scenario**: title (FR/EN), character, goal, starter phrases (3), difficulty.
- **Sentence** (shadowing): English text, French translation, target phonemes, audio at 0.85x and 1x.
- **Turn**: transcript, language segments (EN/FR), word-level scores with confidence, optional Franglais capture.
- **Franglais capture**: French term, English equivalent, example sentence, saved flag.
- **Trap**: id (H, TH, vowels, stress), minimal pairs, French tip text, mouth diagram asset, practice words.
- **Drill item**: French source, literal-trap English (wrong), natural English, explanation FR.
- **Phoneme record**: phoneme, attempts, accuracy trend.

## 6. Labelling (FR / EN)

| Concept | French | English |
|---|---|---|
| Home | Accueil | Home |
| Practice | Pratiquer | Practice |
| Pronounce | Prononcer | Pronounce |
| Progress | Progrès | Progress |
| Shadowing | Répète après moi | Shadowing |
| Roleplay | Jeu de rôle | Roleplay |
| Debate | Débat libre | Debate |
| Daily drill | Défi du jour | Daily drill |
| End | Terminer | End |

Bilingual chrome format: "Jeu de rôle · Roleplay" on pickers; on tight spaces, FR only with EN as accessible secondary text.

## 7. Open IA questions

- Is the Franglais phrase bank a section of Progress, or its own destination? Default here: inside Progress.
- Should level be auto-adjusted over time, or only user-changed?
