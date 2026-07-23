# Roadmap

Last updated: **2026-07-23T08:49:46+08:00**

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
- Typed WebMCP tools with visible, recoverable mutations.
- A deduplicated local score folio with audit details, removal, clear confirmation, and reload-safe direct links.
- Unit, component, browser, coverage, formatting, lint, type, export, and screenshot checkpoints.

## P0 — production recognition and release confidence

1. **Representative recognition evidence**
   - Grow the rights-cleared, source-separated corpus to at least 500 complete guided hands spanning tile sets, phones, lighting, glare, perspective, red fives, and hard negatives.
   - Gate promotion on per-class accuracy, exact-hand accuracy, calibration, correction burden, and unknown-tile recall rather than the current smoke set.
   - Add immutable candidate manifests and safe model rollback after a candidate passes.
2. **Recognition review refinement**
   - Add blur, glare, crop, and perspective-specific guidance while retaining retry, cancel, and manual escape paths.
   - Measure correction burden and refine keyboard/screen-reader traversal on representative devices.
   - Expand from the deliberately narrow closed-hand guide to calls and kans only after each layout has independent evidence.
3. **Device QA**
   - Verify camera, storage recovery, rotation, large text, keyboard, screen readers, reduced motion, and offline restart on representative iOS, Android, and web devices.
   - Benchmark model initialization, preprocessing, inference, memory, thermals, and interaction responsiveness in custom native builds.

Exit gate: representative guided scans meet documented accuracy and latency targets on mid-range hardware, the full journey passes on all targets, and failures degrade cleanly to manual entry.

## P1 — rules and session completeness

- Cross-check a generated scoring corpus against an independent implementation and retain every discrepancy as a regression test.
- Add common Japanese casual/platform rules as named versioned profiles without branching in UI components.
- Add editable completed rounds, result-card sharing, and game-summary export.
- Expand WebMCP only for proven high-value tasks; preserve visible effects, schema validation, and human control.

## P2 — operational polish

- Add CI matrices for quality, static export, browser dogfood, and platform builds.
- Add signed build/release provenance, dependency review, privacy copy, and store-ready metadata.
- Measure startup, memory, model initialization, inference, and bundle growth; run targeted optimization only when a documented budget is crossed.
- Add consented, metadata-stripped recognition feedback only after retention and deletion policy is approved.

## Later experiments

- Center-console OCR, whole-table snapshots, discard recognition, and continuous-video assistance.
- Shanten, waits, and post-game analysis.

These remain experiments until the guided winning-hand scanner is reliable; they must not delay or destabilize the core scoring flow.
