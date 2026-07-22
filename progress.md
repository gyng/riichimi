# Progress

Last updated: **2026-07-23T05:23:45+08:00**

## Current state

Richii is a polished, local-first scoring and table-session app on mobile-width web and desktop web. Its scoring, persistence, camera/gallery fallback, WebMCP surface, and critical browser journeys are implemented and verified. Production physical-tile recognition remains intentionally gated on a licensed model and real-device evaluation; the app says so instead of presenting a simulated detector as complete.

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

## Visual evidence

- [Mobile landing](docs/checkpoints/2026-07-23-01-home-mobile.png)
- [Mobile score audit](docs/checkpoints/2026-07-23-02-manual-score-mobile.png)
- [Mobile table after riichi and undo](docs/checkpoints/2026-07-23-03-session-mobile.png)
- [Desktop score audit](docs/checkpoints/2026-07-23-04-manual-score-desktop.png)
- [Mobile score folio after reload](docs/checkpoints/2026-07-23-05-score-history-mobile.png)
- [Desktop gallery photo review](docs/checkpoints/2026-07-23-06-gallery-review-desktop.png)
- [Mobile table after posting a scored win](docs/checkpoints/2026-07-23-07-session-scored-win-mobile.png)

## Verification commands

```sh
npm run check
npm run build:web
npm run test:e2e
```

## External and environment constraints

- Physical-tile auto-detection is not claimed complete until licensed weights, a representative photo corpus, accuracy targets, and device benchmarks are available.
- Native iOS/Android camera, SQLite, large-text, and screen-reader passes still require real simulators/devices.
