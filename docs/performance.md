# Performance practice

Performance work starts with a reproducible measurement and ends with a comparison against the same workload. Do not trade away correctness, useful tests, accessibility, or architecture for a faster-looking number.

## Initial local baseline

Recorded on 2026-07-23 in the repository development environment:

- Oxfmt repository check: under 0.5 seconds for 55 files
- Vitest domain suite: under 0.3 seconds for 8 tests
- Jest Expo component suite: about 4 seconds cold for 2 tests
- Expo static web export: about 17 seconds cold
- Shared uncompressed web entry bundle: about 1.2 MB before model integration

These numbers are orientation points, not cross-machine guarantees.

## Current local measurements

Recorded on 2026-07-23 after scoring, sessions, score history, gallery review, WebMCP, and the recognition manifest gate:

- Oxfmt repository check: about 0.5 seconds for 117 files
- Vitest suite with coverage: about 0.5 seconds for 104 tests
- Jest Expo component suite: about 2 seconds for 13 tests
- Two Playwright dogfood journeys: 3.7 seconds against the static export
- Expo static web export: about 10 seconds warm, seven static routes
- Static export: 1,539,409 bytes total; shared uncompressed web entry bundle: 1,256,029 bytes

All feedback loops remain below their budgets, so no optimization-only change is warranted. Gallery import and the table-result MCP action increased the shared entry by 10,873 bytes, or about 0.9%, from the previous checkpoint. The WebMCP hook avoids repeated browser registrations during React state updates by keeping registered wrappers stable while delegating execution to the latest tool closures.

An early session build accidentally pulled Expo SQLite's web WASM runtime into Metro and failed on a missing artifact after about 10 seconds. Splitting the persistence adapter by platform fixed the export and avoided adding the database runtime to the browser bundle. Native retains SQLite durability; web uses its native local-storage facility.

### Guided recognition optimization run

Recorded on 2026-07-23 after the offline recognition beta:

- Deterministic CPU training: about 303 seconds and 885 MB peak RSS for 10 epochs; training is an explicit artifact-generation job, not an ordinary feedback loop.
- Warm static export: 5.5 seconds after Metro caching; 17.4 seconds during the measured cold-ish WebGL integration run.
- Shared entry: 1,274,035 bytes, up 18,006 bytes (`1.4%`) from the 1,256,029-byte pre-recognition checkpoint.
- Lazy inference chunk: 467,713 bytes, fetched only after a person requests recognition.
- ONNX classifier asset: 1,866,535 bytes, fetched separately from the initial JavaScript.
- Full static export: 3,892,219 bytes across seven routes, the lazy engine, and model.
- Two Playwright journeys including real exported-app WebGL inference: 4.4 seconds.

The first working WebGL build put the inference runtime in the shared entry, growing it to about 1.74 MB and crossing the 10% explanation trigger. Converting the runtime import to a true async boundary reduced the initial payload to 1.27 MB. The default ONNX Runtime Web WASM entry was also rejected because its dynamic loader is incompatible with Metro and would add a roughly 13.5 MB WASM payload; WebGL is the smaller verified web backend for this beta. The fixed 15-crop input avoids symbolic-shape incompatibility in that backend.

The mandatory tile-level review desk brings the shared entry to 1,282,288 bytes and the full export to 3,901,944 bytes. That is an 8,253-byte (`0.6%`) review-UX increase and a 26,259-byte (`2.1%`) total increase over the 1,256,029-byte pre-recognition entry. The browser dogfood round grew from 4.8 to about 7 seconds because it now performs 15 position selections, 15 full-picker corrections, and a locked-to-reviewed handoff; this is valuable exercised behavior rather than test-harness overhead, and remains below the 15-second component/test feedback budget.

### V1 recognition and rules-profile optimization check

Recorded on 2026-07-23 after physical-corpus expansion, V1 promotion, rules profiles, and reduced-correction dogfood:

- Warm static export: 5.45 seconds, 952,584 KB peak RSS.
- Shared entry: 1,289,101 bytes, up 6,813 bytes (`0.5%`) from the review-desk checkpoint.
- Full export: 3,912,162 bytes, up 10,218 bytes (`0.3%`); the active V1 model remains 1,866,535 bytes.
- Two Playwright journeys: 5.4 seconds, including real WebGL inference and two low-confidence confirmations instead of 15 full-picker corrections.
- Full check: 107 framework-free tests and 35 Expo component tests; formatting stays near 0.5 seconds and coverage tests near 0.5 seconds.

The rules UI and persistence changes remain far below the 10% bundle trigger. V1 replaces—not adds to—the exported model payload, while the retained V0 rollback artifact is not imported and does not ship in the static export. No further application/build/test optimization is warranted at this checkpoint.

### Capture-quality diagnostics check

Recorded on 2026-07-23 after the four-category capture preflight:

- Shared entry: 1,290,977 bytes, up 1,876 bytes (`0.15%`).
- Full export: 3,914,038 bytes, also up 1,876 bytes; model and lazy inference chunks are unchanged.
- Two Playwright journeys: 5.3 seconds, now including a blurred-photo rejection, replacement, clear-photo inference, and two confirmation actions.
- Full check: 107 framework-free tests and 41 Expo component tests.

The diagnostics sample sharpness at a two-pixel stride and complete before model inference. Their bundle and browser-test changes are below every optimization trigger; no special optimization is warranted.

### react-native-web removal

Recorded on 2026-07-25 after replacing react-native-web with local DOM primitives
([ADR 0004](decisions/0004-web-only-dom-primitives.md)):

- Shared entry: 973,730 bytes, **down 300,305 bytes (`23.6%`)** from the
  1,274,035-byte pre-removal checkpoint. Nothing about what the app does changed;
  the saving is the translation layer itself.
- Full build: 3,548,842 bytes. The ONNX model (1,866,535) and the lazy inference
  chunk (462,468) are untouched and still dominate what is fetched.
- Vite build: about 0.8 seconds warm.
- Framework-free suite with coverage: about 1.1 seconds for 314 tests.
- Component suite: about 12 seconds for 144 tests on Vitest with jsdom, against
  about 2 seconds for 41 tests on Jest Expo. Per test the two are comparable
  (83ms vs 49ms) on 3.5x the tests, and this suite now boots a real jsdom
  document and the app's own Vite pipeline rather than a React Native mock — it
  tests the renderer that ships. It sits inside the 15-second budget below;
  environment setup (39s across workers, run in parallel) is the dominant cost
  and is where any future optimization should look.
- Lint: about 0.9 seconds.

This is a bundle win large enough to record but not one that needed pursuing: it
fell out of removing an indirection, which is the cheapest kind.

### CSS Modules, tokens, and localization

Recorded on 2026-08-02 after converting `packages/ui` and every screen to real
CSS with design tokens, adding four-language localization, and shipping the win
announcer:

- Shared entry: 955,280 bytes of JavaScript plus a 48,843-byte stylesheet, so
  1,004,123 bytes together against the 973,730-byte single-file entry before the
  conversion. That is **30,393 bytes (`3.1%`)** for four languages, the
  announcer, and the celebration — and the split is worth more than the delta:
  the stylesheet is static, cacheable, and parsed off the JavaScript critical
  path instead of being constructed at runtime.
- Gzipped, the pair is 204.29 kB + 7.99 kB. CSS compresses to 16% of its size;
  the same rules expressed as style objects in JavaScript did not.
- Full build: 3,578,816 bytes. The ONNX model (1,866,535) and the lazy WebGL
  inference chunk (462,468) still dominate, and both are unchanged.
- Cold Vite build: 1.64 seconds wall, 370,804 KB peak RSS, 197 modules — far
  inside the 45-second CI budget.
- Full check: 292 framework-free tests and 155 component tests.

The celebration fonts are the only notable new asset (`YujiSyuku` 115,380 bytes,
`YujiBoku` 10,008), and each is subset to the few glyphs it draws. No
optimization is warranted at this checkpoint.

## Feedback-loop budgets

- Formatting should remain below 2 seconds locally.
- Framework-free unit tests should remain below 2 seconds for the ordinary suite.
- Component tests should remain below 15 seconds before sharding or isolation changes are considered.
- A cold web build should remain below 45 seconds in CI before targeted build profiling is required.
- Any change that grows the shared entry bundle by more than 10% needs a bundle explanation.
- Camera capture must keep the UI responsive; recognition and image preprocessing must not block interaction frames.

## Optimization runs

### Application

Measure startup, route transitions, render counts, camera preview responsiveness, image preprocessing, model initialization, inference latency, peak memory, and bundle composition. Profile representative mid-range devices, not only desktop simulators.

### Lint and type checking

Run `npx oxlint --type-aware --debug timings` and inspect project assignment before changing rules. Narrow accidental TypeScript includes and generated directories first.

### Tests

Use runner timing output to locate slow files. Remove unnecessary environment setup, replace slow external adapters with faithful in-memory fakes, and separate runtime-specific suites. Preserve isolation and assertion value.

### Builds

Compare cold and warm runs. Inspect the Vite/Rolldown bundle composition and duplicate dependencies before adding caching or custom transforms. Record the command, machine class, revision, and result for any optimization that becomes a durable engineering decision.
