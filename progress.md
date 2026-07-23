# Progress

Last updated: **2026-07-23T08:49:46+08:00**

## Current state

Richii is a polished, local-first scoring and table-session app on mobile-width web and desktop web. Its scoring, persistence, WebMCP surface, guided camera/gallery recognition beta, mandatory review handoff, and critical browser journeys are implemented and verified. Production physical-tile accuracy remains intentionally gated on a representative corpus and real-device evaluation; the app labels the current model as beta instead of overstating nine-crop evidence.

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
- Added nested storage validation, platform-specific persistence, a read-only `richii.history.list` WebMCP tool, and visible saved-state feedback from the calculator.
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
- Extended WebMCP with `richii.manual.record_table_result`, which posts only a visible successful score into its active table through the same persistent, undoable session action as the UI.
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

## Verification commands

```sh
npm run check
npm run build:web
npm run test:e2e
```

## External and environment constraints

- Guided physical-tile recognition is a licensed, working beta, but production accuracy is not claimed until the 500-hand representative gate and device benchmarks pass.
- Native iOS/Android inference requires a custom development build because ONNX Runtime React Native is not available in Expo Go; camera, SQLite, large-text, screen-reader, latency, and memory passes still require real simulators/devices.
