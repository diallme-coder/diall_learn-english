# 05 - Accessibility Plan (WCAG 2.2 AA)

Target: WCAG 2.2 Level AA across the PWA, plus selected AAA practices where cheap (target size 44px, 7:1 text where achieved). A voice-first product has a specific risk: it can exclude Deaf and hard-of-hearing users, people with speech differences, and anyone who cannot speak aloud in context. Every audio feature therefore needs a visual equivalent, and every speech input a non-speech path.

## 1. Audio and speech (1.2, 1.4.2, 2.2)

| Need | Design response |
|---|---|
| Captions for all audio (1.2.1/1.2.2 principle) | All AI speech has streaming captions (word-synced where available). Captions cannot be turned off at A1-A2 practice sessions without a Settings confirmation, and are on by default at all levels. |
| Model sentences (Shadowing, TTS) | Text is always visible beside the replay button. |
| User speech | Live transcript shown so the user sees what the system heard. |
| Audio control (1.4.2) | Autoplay only after a user gesture (starting a session). Pause/stop for AI speech always one tap away ("Interrompre"). Volume and speed (0.6x, 0.85x, 1x) controls. |
| Non-speech input path | Text answer mode in every practice screen (also the mic-denied path). Pronunciation scoring is unavailable in text mode and labelled as such, not hidden. |
| Speech differences | Push-to-talk and generous silence timeouts; "Prends ton temps" pacing; no scoring penalty for slow speech; scoring only on target words, not fluency, in A1-A2. |
| Deaf / hard of hearing | Pronunciation fixer offers visual diagrams, syllable beat visuals, and text; clearly states audio-dependent exercises can be skipped without losing progress. Proposed: an option to disable audio-only exercises. |
| Sound cues | Earcons are optional and duplicated visually (state label, ring). No information is audio-only. |

## 2. Keyboard and focus (2.1, 2.4, 2.4.11 Focus Not Obscured, 2.5.7/2.5.8)

- Everything operable with keyboard (desktop/tablet and switch devices): Tab order follows visual order; mic button is a native `<button>`.
- Suggested shortcuts (documented in Settings): Space = push-to-talk toggle when mic focused; `R` replay model audio; `Esc` interrupt AI. Shortcuts are single-character, so offer a way to turn them off (2.1.4).
- Visible focus: 3px outline using `--color-focus` with 2px offset (tokens). Sticky controls (tab bar, mic area) must not hide the focused element: use `scroll-padding-bottom` equal to the control height (2.4.11).
- Bottom sheets and the mic-denied panel: focus moves in, trap while open, `Esc` closes, focus returns to trigger.
- Targets: minimum 44x44 CSS px for buttons and chips (`--touch-min`), exceeds 24x24 (2.5.8). Mic 80px.
- Dragging: none required; any gesture-based feature (swipe to next) has a button (2.5.7).
- Session exit and back always available (no keyboard trap); consistent location of "Terminer" (3.2.3, 3.2.6 Consistent Help: help/"Besoin d'aide ?" stays in the same place).

## 3. Screen readers (4.1.2, 4.1.3)

- Landmarks: `header`, `main`, `nav` (tab bar, labelled), session regions.
- Status line (`role="status"`, `aria-live="polite"`) announces state changes: "Je t'écoute", "Je réfléchis", "Alex parle". Announce once per state; do not announce every streamed word.
- AI captions stream inside a log region (`role="log"`) but with `aria-live="off"` while streaming and a single polite announce on completion, to avoid talk-over with the user's own speech and with TTS.
- Do not announce while the user is speaking (screen reader speech would be captured by the mic). Offer a setting "Silence screen-reader announcements during recording"; recommended with headphones. This is a known conflict between voice input and screen readers and needs testing.
- Mic button: `aria-label` reflects state ("Appuie pour parler" / "Interrompre"), `aria-pressed` not used for the toggle; state exposed via label and the `data-state` for styling only.
- Word highlights: each word span has `aria-label="coffee, presque"` (text of the outcome) or equivalent in current UI language; glyph pseudo-elements are decorative.
- Franglais side-card: `role="status"`, announced after the AI reply finishes; buttons labelled ("Écouter traffic jam", "Garder cette phrase").
- Mouth diagrams: SVG with `role="img"`, `<title>` and long text alternative in French (and English when the UI is bilingual or English), describing tongue/teeth/lips positions. The diagram is not the only carrier of the tip.
- Language attributes: `lang="fr"` on French strings, `lang="en"` on English practice content so TTS and screen readers pronounce correctly (3.1.2). IPA wrapped with `lang="en-fonipa"` or marked `.ipa` with an `aria-label` spelling the sound for AT where meaningful.

## 4. Colour and contrast (1.4.1, 1.4.3, 1.4.11)

Measured with the WCAG relative-luminance formula against the token values (script run during design; rerun in CI once the build exists):

| Pair | Ratio |
|---|---|
| Text on page bg (light) | 16.11:1 |
| Muted text on white / on page bg | 7.03:1 / 6.55:1 |
| Muted text on sunken surface | 6.08:1 |
| White on primary blue | 6.57:1 |
| White on coral mic | 5.26:1 |
| Text on yellow highlight fill | 13.26:1 |
| Text on red highlight fill | 14.20:1 |
| Warn underline on white / on yellow | 6.92:1 / 5.31:1 |
| Error underline on red fill | 5.37:1 |
| OK underline on white | 6.82:1 |
| Focus ring (light) on bg | 8.44:1 |
| Dark: text on bg / muted on surface | 16.07:1 / 7.90:1 |
| Dark: text on primary / on mic | 8.95:1 / 7.51:1 |
| Dark: focus ring on bg | 12.93:1 |
| Dark: danger on danger-subtle | 7.02:1 |

Not yet measured: translucent dark-mode highlight fills (`--hl-warn-bg`, `--hl-err-bg` use alpha); verify the composited colour against surfaces in the browser. Non-text contrast (1.4.11): borders and underlines above 3:1 on their backgrounds; verify composited values.

- **Never colour alone (1.4.1)**: yellow/red highlights pair with underline style (wavy vs double vs dotted), thickness, weight, a glyph, and a text label on tap/focus. Progress bars carry a text label. Buttons in error state use a double border.
- **Colour-blind check**: yellow vs red differentiated by pattern; test with deuteranopia/protanopia simulation.
- Dark mode via `prefers-color-scheme`; forced-colors mode removes fills and relies on underline patterns (tokens provide this).
- Text spacing (1.4.12): line-height 1.5+ (1.7 for highlighted text); layouts survive user overrides; no fixed-height text containers.
- Reflow and zoom (1.4.4, 1.4.10): usable at 200% text and 320px width without horizontal scroll (rem units, flexible grids). Don't lock orientation (1.3.4).

## 5. Motion and time (2.2.2, 2.3.1, 2.3.3)

- `prefers-reduced-motion`: pulse ring becomes static ring, waveform becomes static bars, card entrance is instant, karaoke highlight becomes bold + outline on the current word. Durations collapse via tokens. In-app override in Settings ("Réduire les animations") for users whose OS setting is unset.
- No flashing content. Pulse is slow (1.6 s cycle).
- No time-limited inputs that cannot be extended: silence nudges are not deadlines; sessions pause rather than fail (2.2.1).
- Auto-collapsing side-card (6 s): content moves to a reachable pill, not deleted; the timeout can be disabled in Settings (2.2.1/2.2.2 intent).

## 6. Forms, errors, onboarding (3.3, 3.2)

- Level selection and goal questions use labelled radio groups; "Passer" skip available.
- Errors: text message, identify the problem, offer a fix (see 04 ladder); not colour only; focus moves to the error banner on failure; error messages announced via `role="alert"` only for blocking failures.
- Redundant entry (3.3.7): placement answers and settings are remembered; don't ask for the same thing twice.
- Accessible authentication (3.3.8): Supabase auth should offer passkey/magic link, no cognitive tests (puzzle CAPTCHAs); to confirm with engineering.
- Language of UI follows level, but can be set independently in Settings (a C1 user may need French chrome, an A2 user may prefer English).

## 7. PWA and platform

- Installable PWA keeps zoom enabled (no `user-scalable=no`).
- Respect safe areas (`env(safe-area-inset-*)`).
- Offline states are text-described, not icon-only.
- Microphone permission flow explains why before the browser prompt and has a recovery steps sheet for denied.

## 8. Test plan (summary; expand with accessibility-test-plan skill if desired)

| Layer | What | When |
|---|---|---|
| Automated | axe/Lighthouse on all routes, contrast script, HTML validation, token contrast CI check | Every PR |
| Manual keyboard | Full journey: onboarding > roleplay > drill > progress with keyboard only | Each release |
| Screen readers | VoiceOver iOS Safari, TalkBack Android Chrome, NVDA + Firefox/Chrome, JAWS if available; special focus on mic + announcements conflict | Each release; before launch |
| Visual | 200%/400% zoom, 320px width, forced colors, dark mode, colour-blind simulation | Each release |
| Motion | `prefers-reduced-motion` on, OS and in-app | Each release |
| Users | Sessions with people who are Deaf/hard of hearing, blind/low vision, with speech differences, and with motor impairments; recruit through a partner organisation. Do not claim results before they exist. | Before public launch |

Pass criteria: no blocking issue on core flows (start session, speak, read feedback, finish); all audio has text; all speech input has text alternative; highlights distinguishable in greyscale.

## 9. Known risks and open items

- Screen reader announcements vs live microphone capture.
- Whisper accuracy on accented or atypical speech may produce false "errors"; mitigated by confidence threshold and "Pas sûr" state, but needs data.
- Mouth diagram alt text quality; needs review by a phonetics-aware French speaker.
- Language switching inside a single screen (FR chrome + EN content): verify screen-reader voice switching.
