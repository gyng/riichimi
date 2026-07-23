# Richii

Local-first riichi mahjong scoring for mobile and web, with auditable WRC-based rules profiles, camera-assisted entry, and persistent four-player table sessions.

The current app includes a complete manual calculator, persisted WRC 2025 and explicit red-five-table profiles, a device-local score folio, camera or gallery capture, a rights-traceable offline guided-recognition beta with mandatory photo-backed review, yaku/fu/payment explanations, durable local table state, automatic transfers and round advancement, round history, undo, and progressive-enhancement WebMCP tools for agent-assisted navigation, scoring, history inspection, rules selection, and table operation. The promoted V1 recognizer reaches 93.48% top-1 on 46 source-separated physical crops while retaining 100% accuracy among reads accepted above its conservative threshold; a strict release gate prevents that limited result from being presented as production accuracy. Product sequencing lives in [`docs/riichi-score-calculator-plan.md`](docs/riichi-score-calculator-plan.md), with training, provenance, evidence, and limitations in the [`recognition model audit`](docs/recognition-model-audit.md).

## Prerequisites

- Node.js 22.13 or newer; Node 24 LTS is recommended
- npm 11 or newer
- Android Studio or Xcode only when running a native simulator

## Start

```sh
npm install
npm run web
```

Use `npm start` for the Expo development menu, or `npm run android` / `npm run ios` for a native target.

Native recognition uses ONNX Runtime React Native and therefore needs an Expo custom development build; it is not available in Expo Go. Web recognition lazy-loads the local model runtime only after you ask it to read a guided photo.

After `npm run build:web`, use `npm run serve:web` to serve the static export with working clean-route reloads and direct links.

## Quality gate

```sh
npm run check
npm run build:web
npm run test:e2e
```

`npm run lint` uses Oxlint's tsgolint integration for both type-aware lint rules and TypeScript 7 project diagnostics. Oxfmt is the only formatter. The Playwright suite runs two focused browser dogfood rounds against the exported site, including a complete scored-hand-to-table transfer and real gallery-photo model inference, and regenerates the dated visual checkpoints in [`docs/checkpoints`](docs/checkpoints/README.md).

## Workspace map

```text
apps/client       Universal React 19 + Expo application
packages/ui       Shared atomic React Native UI
packages/score-core  Framework-free mahjong domain foundation
packages/session-core  Pure table progression and score-transfer policy
packages/rules    Versioned ruleset references and profiles
packages/vision   Platform-neutral recognition contracts and post-processing
docs              Product, architecture, design, testing, and ADRs
e2e               Critical-journey specifications
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md) before implementation work.

Performance budgets and profiling triggers live in [`docs/performance.md`](docs/performance.md). Security reporting and the currently accepted upstream Expo advisory are documented in [`SECURITY.md`](SECURITY.md).
