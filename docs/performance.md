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

## Feedback-loop budgets

- Formatting should remain below 2 seconds locally.
- Framework-free unit tests should remain below 2 seconds for the ordinary suite.
- Component tests should remain below 15 seconds before sharding or isolation changes are considered.
- A cold web export should remain below 45 seconds in CI before targeted build profiling is required.
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

Compare cold and warm runs. Inspect Metro bundle composition and duplicate dependencies before adding caching or custom transforms. Record the command, machine class, revision, and result for any optimization that becomes a durable engineering decision.
