# Progress

Last updated: **2026-08-02T00:00:00+08:00**

## Current state

Riichimi is a polished, local-first scoring and table-session app for the browser. Its scoring, six sourced rules profiles plus a house-rule editor, editable event-sourced rounds, four-language localization, win announcer, WebMCP surface, guided camera/gallery recognition beta, mandatory review handoff, and critical browser journeys are implemented and verified.

The client is web-only: a React 19 app on Vite rendering real DOM elements styled by co-located CSS Modules over design tokens, with no React Native, react-native-web, or Expo package in the tree.

Recognition remains the open front. V1 materially improves source-separated physical accuracy and browser correction burden, but production accuracy is intentionally gated on a representative complete-hand corpus and real-device evaluation, and the 46-crop held-out set is too small to resolve a change from noise.

## Timestamped checkpoints

### 2026-07-23T04:32:26+08:00 — deterministic quality gate

- Oxfmt check and Oxlint/tsgolint passed.
- 101 Vitest domain/application tests passed with 98.74% statements, 93.87% branches, 100% functions, and 98.67% lines.
- 7 Jest Expo component tests passed across manual scoring, landing, scan fallback, and session behavior.

### 2026-07-23T04:41:09+08:00 — WebMCP and browser dogfood

- Added typed, progressive-enhancement WebMCP tools for app inspection, navigation, example loading, scoring, table creation, riichi, exhaustive draws, and undo.
- Dogfood round 1 passed at 390 × 844 through WebMCP: discovery → manual example → 2 han / 20 fu score → named table → riichi → noten settlement → undo.
- Dogfood round 2 passed at 1280 × 900 through visible controls: manual example → score audit → camera-permission recovery → manual fallback.
- The dedicated browser test port no longer risks reusing an unrelated local app.
- Stable WebMCP wrappers prevent registration churn while keeping execution state current.

### 2026-07-23T04:41:09+08:00 — export and performance

- Expo exported six static routes successfully.
- Export size is 1.6 MB; the shared uncompressed entry is 1,226,885 bytes.
- Warm export was about 8 seconds and both browser journeys took about 3 seconds, below the documented optimization triggers.

### 2026-07-23T04:47:27+08:00 — HTTP polish

- Added the branded export favicon after dogfood server logs exposed a missing `/favicon.ico` request.
- Expo generated a multi-resolution `favicon.ico`; the final browser run asserted and observed HTTP 200 responses.

### 2026-07-23T05:00:48+08:00 — standalone score history

- Added automatic local retention for successful standalone scores, with exact-hand deduplication and a 20-entry cap.
- Added the responsive Score folio route with tiles, winning-tile emphasis, context, yaku, payments, removal, and confirmed full clearing.
- Added nested storage validation, platform-specific persistence, a read-only `riichimi.history.list` WebMCP tool, and visible saved-state feedback from the calculator.
- Browser dogfood proved scoring → history navigation → full `/history` reload → persisted audit on mobile, plus visible desktop history navigation.
- Replaced the generic static test server after it exposed a clean-route 404; `npm run serve:web` now maps Expo route paths to their exported HTML files.
- Made `npm run test:e2e` own the server lifecycle and wait for an explicit readiness signal, avoiding a proxy-sensitive Playwright preflight probe.
- Export remains 1.6 MB across seven routes; the shared entry is 1,245,156 bytes.

### 2026-07-23T05:23:45+08:00 — gallery review and recognition release gate

- Added local gallery selection beside camera capture, an explicit review state, photo-reference handoff into manual entry, picker failure recovery, and Android pending-result recovery.
- Fixed a state-ordering defect found by the new component test: a selected gallery image now renders even when camera permission is denied.
- Browser dogfood now drives a real file chooser with a code-native guided-hand fixture and verifies the full gallery → review → manual-reference journey.
- Added a recognition model audit and a tested manifest gate for artifact integrity, HTTPS provenance, SPDX licensing, RGB/NCHW input, all required tile classes, evaluation-set size, and release accuracy.
- Reviewed available model candidates without importing unvalidated or licensing-ambiguous weights.
- Extended WebMCP with `riichimi.manual.record_table_result`, which posts only a visible successful score into its active table through the same persistent, undoable session action as the UI.
- The mobile dogfood round now proves table → linked calculator → inherited context → score → exact transfers → dealer repeat → persistent round history.
- The full quality gate passed: 104 Vitest tests at 98.79% statement / 94.23% branch coverage, 13 Jest component tests, seven-route export, and two Playwright journeys in 3.7 seconds.
- The shared web entry is 1,256,029 bytes, a 0.9% increase from the score-history checkpoint and below the 10% optimization trigger.
- Initialized the repository and created the verified baseline commit after project, generated-output, and secret-scope audits.

### 2026-07-23T08:37:10+08:00 — guided offline recognition beta

- Researched public physical-tile models and datasets, rejected private weights, credential-gated artifacts, incomplete class sets, ambiguous scraped-image provenance, and unapproved license boundaries.
- Built a deterministic, reproducible classifier pipeline from pinned CC0 artwork and licensed physical-photo crops; committed source hashes, crop coordinates, partitions, attribution, scripts, reports, and the 1.87 MB ONNX artifact.
- Added strict guided localization for exactly 14 separated hand tiles plus one dora, fixed-batch preprocessing, 38-class decoding, top alternatives, unknown handling, and confidence/structural review.
- Added lazy ONNX Runtime WebGL inference and ONNX Runtime React Native adapters. Captures and inference remain local; no image-upload WebMCP surface was added.
- Connected gallery/camera review → offline recognition → visible uncertainty count → prefilled 14-tile/dora/winner draft → photograph-backed correction → normal scoring.
- The source-separated physical smoke set scored 7/9 top-1. A `0.75` threshold accepted 2/9 and both were correct; low coverage is intentional while evidence is small. The v0 artifact does not pass the 500-hand production release gate.
- Browser dogfood found and fixed Metro's incompatible default WASM import, then found and fixed a symbolic-batch incompatibility in WebGL. The final exported-app run executes the real model and completes both browser journeys in 4.4 seconds.
- A bundle-growth optimization lazy-loads the 467,713-byte inference engine. The shared entry is 1,274,035 bytes, only 1.4% above the previous 1,256,029-byte checkpoint; the model is a separate 1,866,535-byte asset.
- Recognition/domain/component coverage now includes layout rejection, tensor equivalence, output review, routing validation, adapter orchestration, and the browser-level model execution journey.

### 2026-07-23T08:49:46+08:00 — mandatory tile-level recognition review

- Closed a safety contradiction discovered by the completion audit: the prior handoff counted uncertain reads but did not identify them individually or prevent immediate scoring.
- Added a photograph-adjacent review desk for all 15 reads with visible confidence, precise position/role labels, red issue outlines, top-three one-tap choices, and a complete 37-tile picker.
- The picker enforces the four-copy physical inventory while replacing a tile, and winner reassignment atomically clears the previous winning role.
- Scoring stays locked until confidence, unknown-tile, role, winner-count, and impossible-count issues are all resolved. The scoring ledger records how many uncertain reads were explicitly confirmed or corrected.
- Exported-browser dogfood now corrects every one of the deliberately out-of-distribution fixture's 15 model proposals against the visible photo before the reviewed handoff succeeds.
- The quality gate passes with 105 framework-free tests and 28 Expo component tests. Both browser journeys, including 30 visible review interactions and real ONNX inference, complete in about 7 seconds.
- The review desk adds about 8.3 KB to the shared entry. At 1,282,288 bytes, the entry is 2.1% above the pre-recognition checkpoint and remains well below the 10% optimization trigger.

### 2026-07-23T09:20:42+08:00 — physical classifier V1 and rules truthfulness

- Re-audited open physical-tile sources and added three author-owned, CC BY-SA 4.0 Japanese tile-set photographs with full standard/red-five coverage. Two distinct families are training-only; the Kantou family is source-separated evaluation-only.
- Expanded physical training from 33 to 107 crops and held-out evaluation from 9 to 46 crops. Deterministic grid expansion, source hashes, licenses, partitions, and a reproducible fixture builder are committed.
- Promoted `tile-classifier-v1.onnx`: physical top-1 improved from 73.91% to 93.48%; accepted coverage at the conservative 0.75 threshold improved from 28.26% to 78.26%; accepted accuracy stayed 100%. All three wrong proposals remain below threshold and cannot bypass review.
- Replaced the synthetic-font browser fixture with a CC BY-SA 4.0 physical-tile composite from the held-out family. Exported WebGL dogfood reads all 15 classes correctly and needs only two low-confidence confirmations instead of 15 full-picker corrections.
- Added persistent WRC 2025 and explicit WRC-based red-five-table profiles. Rules now control red-tile availability and scoring, survive reload, migrate old tables, pin at East 1, appear in score/session audit UI, and can be selected through WebMCP.
- Browser dogfood found and fixed a preference-hydration race and missing web `aria-checked` state. The final two exported journeys pass in 5.4 seconds.
- The final quality gate passes with 107 framework-free tests, 35 Expo component tests, a 5.45-second warm export, and a 1,289,101-byte shared entry. V1 replaces the exported V0 payload, so the active model size is unchanged.

### 2026-07-23T09:34:14+08:00 — capture-quality recovery guidance

- Added deterministic, device-local diagnostics before classifier acceptance: clipped-pixel exposure detects strong glare, frame bounds catch cropped tiles, geometry consistency catches excessive perspective, and sampled Laplacian variance catches a localized-but-blurry hand.
- Every issue has a specific recovery instruction and preserves choose-another-photo, retry, and photograph-backed manual entry. Structural layout failures remain distinct from image-quality failures.
- Added six focused diagnostic/integration tests covering the good path, all four failure categories, and proof that severe glare stops before model initialization.
- Browser dogfood first submits a deliberately blurred derivative of the held-out physical fixture, verifies the dedicated blur message without loading a score draft, then replaces it with the clear fixture and completes V1 recognition normally.
- The final browser journeys pass in 5.3 seconds. The shared entry is 1,290,977 bytes, a 1,876-byte (`0.15%`) increase; the model and lazy inference payloads are unchanged.
- The full quality gate passes with 107 framework-free tests and 41 Expo component tests.

### 2026-07-23T18:44:49+08:00 — synthetic-physical 3D tile renderer (phase 1: crops)

- Added `scripts/vision/render_tiles.py`, a headless Blender 5.1+ EEVEE generator that renders standing tiles from the pinned CC0 glyph artwork as physically based 3D objects (ivory body, engraved glyph, glossy coat) under randomized camera pose, studio softbox lighting, and surface imperfections.
- Output is labeled face crops in the `train/<label>/` layout `train-tile-classifier.py --real-crops` already consumes, so renders act as a third training source adding realistic 3D lighting, specular glare, reflection, and geometry the 2D augmentation cannot express.
- Verified end to end: headless run produced correctly labeled, well-exposed, pose/lighting-varied crops across man/pin/sou and red-five classes. Fixed two authoring defects found by the smoke test (front-face material index orphaned by `materials.clear()`; compounding light jitter across samples).
- Committed the authoritative generator, a self-contained `tile_base.blend` reference scene, `docs/recognition-render-sample.png`, and provenance/discipline docs.
- Discipline held: renders are training-side only, written to `train`, never `eval`; worth is measured solely by lift on the real held-out crops via `evaluate-physical-crops.py`, never as release evidence. The shipped model and the 500-hand production gate are unchanged. Phase 2 (full-hand layouts with per-tile boxes for a future localizer) is scoped but not built.
- Ran the first controlled A/B through the full training/eval harness: 296 renders (8/class) added to 107 real train crops, identical settings, evaluated on the 46 held-out real crops. Result was within noise — top-1 93.48%→91.30% (−1 crop), accepted coverage 73.91%→78.26% (+2 crops), accepted accuracy 100% unchanged. No lift established; the treatment model was not promoted. The harness working end to end is the real gain. See the audit's "Initial measurement" note.
- Improved renderer realism (depth of field, white-balance drift, camera roll, stronger engraving, tighter azimuth) and re-ran the A/B down-weighted to ~1:1 (111 renders, 3/class). Down-weighting removed the top-1 regression (back to 93.48% parity) with a one-crop coverage gain (76.09%) — still within noise. Two runs now agree: renders are harmless-to-marginal, not a promotion lever; the real blocker is the 46-crop measurement resolution, not synthetic tuning.
- Added `--mode hand` phase-2 scaffolding: 14+winning+dora layout emitting per-tile label/role/2D-bounding-box JSON (projection verified — boxes tightly bound each tile). It targets a future learned localizer and is not yet consumed. The single-tile crop path is the higher-fidelity glossy generator.
- Fixed phase-2 hand imagery end to end (all 15 tiles render their glyphs, 3/3 sample hands at 15/15). Root causes, found by live-Blender iteration and pixel measurement: the factory startup cube was never removed and occluded the row; face-on glossy tiles reflected the light into the camera (now matte faces + a wide front light sized to the row); and EEVEE raytraced GI bounced the bright faces into a pale wash (disabled for hand mode). Also modelled real two-tone tiles — bone-white face, warm yellow/amber back and sides — which improves crop realism too.

### 2026-07-24T03:13:42+08:00 — scoring cross-check, game summary, and editable rounds

- Cross-checked the scoring engine against the published payment table (exhaustive han×fu×seat×method×kiriage + honba) and canonical worked hands (closed, open, and ambiguous-decomposition), plus open-hand fu/kuipinfu and interpretation-selection. No discrepancy found; vitest grew to exhaustive, externally-anchored regression coverage.
- Added a read-only game-summary export (final standings with tie-breaks, win/draw tally, shareable text), wired into the session screen with a copyable panel; browser-dogfooded.
- Delivered **editable completed rounds** end to end (design by a Fable architect pass; implementation delegated phase-by-phase and reviewed/gated on `npm run check` before each commit):
  - Phase 1: event-sourced the session model (behavior-preserving) — replay equivalence proven.
  - Phase 2: stored-session v2 with a lossless, replay-verified v1→v2 migration reconstructed from the existing undo snapshots (v1 retained until a successful v2 save); ADR 0004.
  - Phase 3: pure edit-operations domain — delete/replace/set-hand-riichi with the hand-segment rule, and stale-honba/dealer _warnings_ (the ledger never silently recomputes scores).
  - Phase 4a/4b: the session-screen inline editor with a mandatory signed-score-change confirmation, and win re-scoring through the calculator in edit mode (honba/context seeded but manually editable).
- Browser-dogfooded the full edit flow including a real v1→v2 migration on load; edits are undoable. Final gate: `npm run check` at 214 domain + 50 UI tests, `build:web` passing.

### 2026-07-24T09:08:16+08:00 — rulesets, house rules, localization, and the mobile pass

- Extended the guided recognizer to **called melds and kans** across four phases: localization, inference into the scored draft, review behind the confirm gate, and an explicit hand-structure confirmation. A scan is now one tap, guided by layout, with a natural single-row capture as the default.
- Added **four sourced ruleset profiles** — Tenhou ranked, EMA 2016, M.League, and JPML A — each citing a primary source and differing only in profile data, never in UI branches. Added a **house-rule editor** so a table can compose and persist its own profile from the same option set.
- Translated the interface into **Japanese, Simplified Chinese, and Traditional Chinese**, following the device language, with the catalog keyed by the English source string so an untranslated key falls back rather than showing a key name.
- Ran the mobile-first pass: play surfaces fit a phone, the home is a dashboard rather than a second nav bar, the table's primary action comes first, navigation moved to a persistent top app bar, and landscape uses the width it gives.
- Tiles draw with real mahjong faces.
- Renamed the project from `richii` to `riichimi`, and added a screenshot rig, a terse README, and Pages deployment.
- Added type checking to the gate after 37 module-resolution errors survived a green run — oxlint's type-aware rules are not a substitute for `tsc`.

### 2026-07-24T22:46:13+08:00 — the announcer and the limit-hand celebration

- A scored win is **announced through a swappable speech port**. The port is narrow (`available`, `speak`, `cancel`) so a local neural voice can replace the Web Speech adapter without touching the announcement text or the calculator.
- Limit hands **celebrate**: fire, lightning, and brush calligraphy revealed stroke by stroke, synced to the announcement, with a bell. Both the voice and the celebration are user switches, and the celebration drops to a still frame under `prefers-reduced-motion`.
- Every yaku is **named in Japanese**, kanji first in the score panel.
- The engine scores **single-yaku double yakuman** (13-wait kokushi, pure nine gates, tanki suuankou, daisuushii), gated by a ruleset flag that every shipped profile currently sets to false.
- Tile review is anchored to the photograph, and its localization is complete.

### 2026-07-25T21:32:16+08:00 — web-only on Vite, then no React Native at all

- Migrated the client to a **web-only Vite app** routed by `react-router`. Metro could not bundle onnxruntime-web or kokoro-js, and native was dropped rather than worked around. Platform splits went with it: every `foo.web.ts` became `foo.ts`.
- Dropped `react-native-svg` for DOM SVG. This also **fixed the dev server**: its Flow-typed Fabric/codegen files broke Vite's dependency optimizer and blanked the tile routes.
- Removed **react-native-web** entirely, then the last Expo packages, taking `react-native` out of the install tree — it had been surviving as a transitive peer. The lockfile went from 850 to 335 packages. The shims that had been aliased over `expo-router`/`expo-camera`/`expo-image-picker` are ordinary adapters now, and `vite.config.ts` aliases nothing. See [ADR 0004](docs/decisions/0004-web-only-dom-primitives.md).
- Converted `packages/ui` and every screen to **real CSS Modules over design tokens**, then deleted the transitional DOM primitives. `:active` and `:disabled` replaced JS pressed and disabled styles; media queries replaced measured-width layouts.
- **Accessible names are localized**, including the ones composed at runtime: `translate` fills `{placeholder}` slots so a composed name is one source string a translator sees whole, and tile vocabulary is joined by a locale-owned rule — a screen reader reading Japanese no longer says "5 circles". Controls point at the visible label with `aria-labelledby` instead of duplicating it. The untranslated-string scanner now covers `aria-label` and fails on a template literal, so the gap cannot reopen.
- The client's **coverage floors became a gate** rather than dormant config: `test:ui` runs with `--coverage`. They had been inert since the Jest configuration they were ported from ran without it.
- Entry bundle: 1,274,035 → 973,730 bytes (−24%) from the react-native-web removal alone.

### 2026-08-02T00:00:00+08:00 — documentation reconciliation

- Reconciled the documentation with the shipped app after a week of architectural change: `README`, `CONTRIBUTING`, `SECURITY`, `architecture.md`, `performance.md`, the plan, and the model audit no longer describe an Expo/Metro toolchain that does not exist.
- Recorded the architectural boundaries the change introduced: a **localization** section (why yaku names and fu reasons stay English at the interface ring) and an **audio** section (the speech port, and how both win-feedback channels fail quiet).
- Corrected two documentation claims that had gone false: the README said the engine does not detect single-yaku double yakuman, and `SECURITY.md` documented an Expo `uuid` advisory that no longer exists in the tree.
- Added a bundle checkpoint for the CSS and localization work: 955,280 bytes of JavaScript plus a 48,843-byte stylesheet, 3.1% over the pre-conversion single-file entry for four languages, the announcer, and the celebration. Cold Vite build is 1.64 seconds.
- Cleared a high-severity `react-router` advisory (`GHSA-qwww-vcr4-c8h2`) by upgrading rather than accepting an exception: `react-router-dom` 7.18.1 → `react-router` 8.3.0, which drops the `react-router-dom` package and pulled `react`/`react-dom` to 19.2.8. `npm audit` is clean. Two install hazards found and documented on the way: `packages/ui` pinning React one patch behind the client produced two React copies and 50 dead component tests, and npm will not install react-router's own `cookie-es` dependency in this workspace. See [dependency policy](docs/dependencies.md).

### 2026-08-02T00:00:00+08:00 — an evaluation harness that can say "we cannot tell"

- Added `scripts/vision/evaluate-recognizer.py`. It reports per-class and per-tile-set accuracy, expected and maximum calibration error with reliability bins, the operating point plus a 0.50–0.95 threshold sweep, correction burden per scanned hand, and false-unknown rate — and puts a **95% Wilson interval on every rate**, marking any slice under three crops `resolvable: false`. `--baseline` compares two runs and states whether the difference survives those intervals.
- Fixed the corpus preparation, which no longer reproduced: Wikimedia rejects the script's bare user-agent with HTTP 429, which reads as rate limiting and is not. All 153 crops now rebuild and verify against their pinned SHA-256. `prepared.json` also records `sourceId`, the per-tile-set slice key.
- What the harness found on the shipped V1 artifact:
  - **The gate works.** All three errors are low-confidence (0.12, 0.20, 0.32 against a 0.75 threshold); no wrong read is accepted.
  - **Every error is one tap from correct** — top-3 accuracy is 46/46, and the review desk already offers the top three.
  - **Correction burden is 3.26 reviews per 15-tile hand**; only 2.5% of hands clear untouched. That is the number to move.
  - **The model is under-confident, not over-confident** (ECE 0.140, one over-confident read; reads at 0.42 confidence are 100% correct).
  - **36 of 37 classes cannot be measured** at one or two crops each, and unknown recall cannot be measured at all without hard negatives.
- Ran TTA and temperature scaling through it, and shipped neither. TTA buys one crop of top-1 (93.48% → 95.65%) and costs one review per hand (3.26 → 4.24), a net loss for a review gate. Temperature scaling has no split to fit on: the model is **100% accurate on the training partition**, so likelihood improves without bound as confidence sharpens and the fit runs to the edge of the scan; fitting on evaluation would be fitting to the test. The harness now refuses both rather than emitting a number that looks like a calibration.
- The headline: **neither change separates from baseline**. A 17.4-point coverage swing does not clear the intervals on 46 crops, where one crop is 2.2 points. The two synthetic-render A/B runs that landed "within noise" were reading the same limit. The corpus is the blocker, not the technique, and the report now says so instead of leaving it to judgement.

## Visual evidence

- [Mobile landing](docs/checkpoints/2026-07-23-01-home-mobile.png)
- [Mobile score audit](docs/checkpoints/2026-07-23-02-manual-score-mobile.png)
- [Mobile table after riichi and undo](docs/checkpoints/2026-07-23-03-session-mobile.png)
- [Desktop score audit](docs/checkpoints/2026-07-23-04-manual-score-desktop.png)
- [Mobile score folio after reload](docs/checkpoints/2026-07-23-05-score-history-mobile.png)
- [Desktop gallery photo review](docs/checkpoints/2026-07-23-06-gallery-review-desktop.png)
- [Mobile table after posting a scored win](docs/checkpoints/2026-07-23-07-session-scored-win-mobile.png)
- [Desktop offline recognition review](docs/checkpoints/2026-07-23-08-offline-recognition-review-desktop.png)
- [Desktop photograph-backed recognized draft](docs/checkpoints/2026-07-23-09-recognized-draft-desktop.png)
- [Desktop recognition review completed](docs/checkpoints/2026-07-23-10-recognition-review-complete-desktop.png)
- [V1 physical recognition with two flagged reads](docs/checkpoints/2026-07-23-11-v1-recognition-review-desktop.png)
- [V1 recognition review completed](docs/checkpoints/2026-07-23-12-v1-recognition-complete-desktop.png)
- [V1 photograph-backed recognized draft](docs/checkpoints/2026-07-23-13-v1-recognized-draft-desktop.png)
- [Blur-specific recovery guidance](docs/checkpoints/2026-07-23-14-blur-recovery-guidance-desktop.png)
- [Copyable game summary](docs/checkpoints/2026-07-24-15-game-summary-desktop.png)
- [Editing a completed round](docs/checkpoints/2026-07-24-16-edit-round-desktop.png)

## Verification commands

```sh
npm run check
npm run build:web
npm run test:e2e
```

## External and environment constraints

- Guided physical-tile recognition is a licensed, working beta with materially stronger crop evidence, but production accuracy is not claimed until the 500-hand representative gate and device benchmarks pass.
- The 46-crop held-out set cannot resolve a recognizer change from noise. Two controlled synthetic-render A/B runs both landed inside it, which is a measurement limit rather than a result about renders.
- Riichimi is browser-only, so device QA means mobile Safari and Chrome on real hardware. Camera, large-text, screen-reader, latency, and memory passes on representative phones remain unverified.
- Yaku names and fu-audit reasons render in English in every locale by design; see the localization boundary in [architecture](docs/architecture.md).
