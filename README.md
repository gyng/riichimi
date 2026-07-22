# Richii

Local-first riichi mahjong scoring for mobile and web, with an auditable WRC 2025 engine, camera-assisted entry, and persistent four-player table sessions.

The current app includes a complete manual calculator, locally persisted standalone score folio, camera or gallery capture with an on-device photo reference fallback, yaku/fu/payment explanations, durable local table state, automatic transfers and round advancement, round history, undo, and progressive-enhancement WebMCP tools for agent-assisted navigation, scoring, history inspection, and table operation. The confidence-aware recognition pipeline and a strict model-release manifest gate are implemented; production physical-tile inference still requires licensed model weights and device validation. Product sequencing lives in [`docs/riichi-score-calculator-plan.md`](docs/riichi-score-calculator-plan.md), with candidate research in the [`recognition model audit`](docs/recognition-model-audit.md).

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

After `npm run build:web`, use `npm run serve:web` to serve the static export with working clean-route reloads and direct links.

## Quality gate

```sh
npm run check
npm run build:web
npm run test:e2e
```

`npm run lint` uses Oxlint's tsgolint integration for both type-aware lint rules and TypeScript 7 project diagnostics. Oxfmt is the only formatter. The Playwright suite runs two focused browser dogfood rounds against the exported site, including a complete scored-hand-to-table transfer and gallery-photo handoff, and regenerates the dated visual checkpoints in [`docs/checkpoints`](docs/checkpoints/README.md).

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
