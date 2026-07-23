# Roadmap

Last updated: **2026-07-24T02:00:00+08:00**

## Product objective

Deliver a polished mobile/web riichi companion that reaches an auditable result with the least safe amount of manual work. Automation may reduce effort, but it may not hide uncertainty, invent context, or make irreversible changes.

## Shipped foundation

- WRC 2025 scoring with validation, decomposition, yaku/yakuman, fu, limits, payments, and explanations.
- Responsive React 19 / Expo manual calculator and guided camera capture with private photo-reference fallback.
- Local table sessions with round context, riichi deposits, exhaustive-draw transfers, progression, history, persistence, erase confirmation, and undo.
- Recognition contracts and confidence-aware correction prioritization.
- Camera and gallery photo review with reference-preserving manual handoff and Android picker recovery.
- A versioned recognition artifact manifest gate covering integrity, provenance, classes, input, and release metrics.
- A rights-traceable guided recognition beta with deterministic 15-face localization, a bundled ONNX classifier, web/native adapters, confidence and physical-count review, and photograph-backed draft correction.
- A reproducible vision pipeline with pinned sources, crop partitions, augmentation, ONNX parity, artifact hashing, licensing, synthetic validation, and source-separated physical smoke evaluation.
- A tile-by-tile recognition review desk with visible confidence, top-three confirmation, a physically bounded full picker, atomic winner reassignment, and a hard gate against scoring unresolved reads.
- A V1 physical classifier promoted through source-separated comparison: 93.48% top-1 and 78.26% accepted coverage on 46 physical crops, with 100% accuracy among accepted reads and all errors retained for review.
- Deterministic pre-inference capture diagnostics with blur, glare, edge-crop, and excessive-perspective recovery guidance.
- Persistent WRC 2025 and explicit red-five-table profiles, with rules-aware tile entry, score attribution, legacy migration, and immutable per-table pinning.
- Typed WebMCP tools with visible, recoverable mutations.
- A deduplicated local score folio with audit details, removal, clear confirmation, and reload-safe direct links.
- Unit, component, browser, coverage, formatting, lint, type, export, and screenshot checkpoints.

## P0 — production recognition and release confidence

1. **Representative recognition evidence**
   - Grow the rights-cleared, source-separated corpus beyond the current 107 training / 46 held-out physical crops to at least 500 complete guided hands spanning tile sets, phones, lighting, glare, perspective, red fives, and hard negatives.
   - Gate promotion on per-class accuracy, exact-hand accuracy, calibration, correction burden, and unknown-tile recall rather than the current smoke set.
   - Add immutable candidate manifests and safe model rollback after a candidate passes.
2. **Recognition review refinement**
   - Tune the shipped blur, glare, crop, and perspective diagnostics on representative phones and lighting conditions while retaining retry, cancel, and manual escape paths.
   - Measure correction burden and refine keyboard/screen-reader traversal on representative devices.
   - Expand from the deliberately narrow closed-hand guide to calls and kans only after each layout has independent evidence.
3. **Recognition robustness (safe-failure first)**
   - **Evaluation harness** — per-class accuracy, calibration (ECE / reliability), per-tile-set slices, unknown recall, and correction-burden reporting over the real held-out crops, so any recognizer change is measurable rather than lost in the 46-crop noise floor. Prerequisite for everything below.
   - **Test-time augmentation + confidence calibration** — average predictions over small crops/flips and apply temperature scaling, then measure accepted-coverage/accepted-accuracy/ECE on the real crops. Targets the axis that matters most for a review-gated scanner: catching its own errors (fewer confident-wrong, better unknown-flagging), not just raw top-1.
   - A learned localizer (to handle touching tiles and textured tables — the biggest practical brittleness) is gated on boxed real data; the synthetic hand renderer already scaffolds per-tile boxes for it.
4. **Device QA**
   - Verify camera, storage recovery, rotation, large text, keyboard, screen readers, reduced motion, and offline restart on representative iOS, Android, and web devices.
   - Benchmark model initialization, preprocessing, inference, memory, thermals, and interaction responsiveness in custom native builds.

Exit gate: representative guided scans meet documented accuracy and latency targets on mid-range hardware, the full journey passes on all targets, and failures degrade cleanly to manual entry.

## P1 — rules and session completeness

- Cross-check the scoring engine against published tables and canonical worked hands; retain every discrepancy as a regression test. (Done for the payment table and closed/open/ambiguous worked hands; keep extending as rules grow.)
- Game-summary export (done) and result-card sharing built on top of it.
- **Editable completed rounds.** Requires a replayable event log first: `declareRiichi` is not currently recorded as an event, so editing a past round and recomputing downstream would lose riichi-stick timing and silently corrupt scores. A Fable architect pass owns the design; implementation is delegated from that design. The feature must never silently change scores — every recompute is auditable and reversible.
- **Named, versioned, immutable ruleset profiles**, added without branching in UI components:
  - Tenhou and Mahjong Soul (Jantama) variants.
  - EMA (European Mahjong Association) competition rules.
  - M.League rules.
  - JPML (Japan Professional Mahjong League, rulebook A) rules.
    These differ across aka dora, open tanyao (kuitan), kiriage mangan, kazoe cap (sanbaiman vs yonbaiman), double-wind-pair fu, uma/oka, starting/return points, tobi/busting, and nagashi mangan — so `ScoringRules` and the session model must grow beyond the current WRC-only shape (e.g. `countedLimit` is presently fixed to `"yonbaiman"`, double-wind pair fu is fixed at +2). Expand the scoring cross-check corpus per profile as each lands.
- **House-rule editor** — let users compose and persist a custom ruleset profile from the same option set, with validation, sensible presets, and immutable per-table pinning.
- Expand WebMCP only for proven high-value tasks; preserve visible effects, schema validation, and human control.

## P1 — experience, localization, and audio

- **Mobile-first UI pass.** Design the primary layouts for narrow phones first (48px+ touch targets, thumb reach, one-handed scoring, bottom-anchored primary actions), then scale up to desktop — rather than adapting a desktop layout down. Re-audit every screen against real device widths and large text.
- **Win announcer (Mahjong Soul style).** Announce the winning hand and its yaku/score. Build a TTS **port/abstraction** so the voice backend is swappable: start with the browser Web Speech API (Web TTS), and keep the interface ready for later on-device engines (Piper, Moonshine). Respect reduced-motion and quiet/mute preferences; never block scoring on audio, and keep audio out of the domain (adapter only).
- **Internationalization, especially CJK.** Extract all user-facing strings behind an i18n layer; support Japanese and Chinese alongside English, with correct CJK typography, tile/term names, and pluralization. Keep number/point/date formatting locale-correct at the interface layer without leaking locale or `Intl`/clock access into the domain.

## P2 — operational polish

- Add CI matrices for quality, static export, browser dogfood, and platform builds.
- Add signed build/release provenance, dependency review, privacy copy, and store-ready metadata.
- Measure startup, memory, model initialization, inference, and bundle growth; run targeted optimization only when a documented budget is crossed.
- Add consented, metadata-stripped recognition feedback only after retention and deletion policy is approved.

## Later experiments

- Center-console OCR, whole-table snapshots, discard recognition, and continuous-video assistance.
- Shanten, waits, and post-game analysis.

These remain experiments until the guided winning-hand scanner is reliable; they must not delay or destabilize the core scoring flow.
