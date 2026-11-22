# Real-audio calibration fixtures (empty — post-launch milestone)

This directory is intentionally empty at launch.

Every test under `src/lib/pronunciation/**` runs against **synthetic**,
hand-labeled transcripts in `../synthetic/*.json` — they are shaped like
Whisper `verbose_json` output, but they are not real ASR output and must
not be mistaken for a calibration signal.

Per `docs/PLAN.md` (Unit B, and `docs/MANUAL_QA.md` §Calibration), real
calibration against actual French-accented speech is a **[MANUAL]**
milestone to run **after launch**:

1. Collect about 20 real clips of French speakers reading the isolated
   minimal-pair words and a few shadowing sentences that exercise each
   trap (`th_as_s`, `th_as_f`, `th_as_t`, `dh_as_z`, `dh_as_d`,
   `h_dropped`, `h_inserted`, `ih_vs_iy`, `uh_vs_uw`).
2. Run them through the real transcription adapter to get genuine
   `verbose_json`-style transcripts.
3. Add each clip's transcript here as `fixtures/real/<id>.json`, alongside
   a short note of which trap(s) it is expected to flag.
4. Set the calibration threshold `N` (how many of the known errors the
   scorer must flag) in `docs/MANUAL_QA.md` §Calibration, based on what is
   actually observed — not assumed in advance.
5. Only after that pass should any fixture here be treated as a
   regression baseline.

Until that milestone lands, this directory stays empty by design.
