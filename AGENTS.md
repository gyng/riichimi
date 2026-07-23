# Riichimi engineering instructions

## Mission

Riichimi is a local-first riichi mahjong score calculator for mobile and web. Its defining experience is a trustworthy path from a guided camera capture to an auditable score with minimal correction. Correctness, explicit uncertainty, accessibility, and user control outrank novelty.

Read these before substantial work:

- `docs/riichi-score-calculator-plan.md` for product scope and sequencing
- `docs/architecture.md` for dependency boundaries
- `docs/design-principles.md` for interface and interaction decisions
- `docs/testing-strategy.md` for the test-quality bar
- `docs/performance.md` for feedback-loop budgets and profiling practice
- `docs/decisions/` for accepted architecture decisions

## Standard commands

Run commands from the repository root.

- `npm install` — install exact workspace dependencies
- `npm start` — start the universal Expo app
- `npm run web` — start the web client
- `npm run android` / `npm run ios` — start a native client
- `npm run format` — write formatting with Oxfmt
- `npm run lint` — Oxlint, tsgolint-powered type-aware rules, and TypeScript diagnostics
- `npm run test:unit` — fast domain/application tests with Vitest
- `npm run test:ui` — React Native component tests with Jest Expo
- `npm run test:coverage` — diagnostic coverage report with enforced floors
- `npm run test:e2e` — browser dogfood for visible UI and WebMCP journeys
- `npm run check` — the required local quality gate
- `npm run build:web` — create the static web build
- `npm run serve:web` — serve the export with clean-route/direct-link resolution

Do not introduce ESLint, Prettier, or a second general-purpose formatter. Oxlint and Oxfmt are the repository standards. Type-aware linting and project type checking are intentionally integrated through `oxlint-tsgolint` and TypeScript 7.

## Working method

1. Understand the user outcome and identify the smallest vertical slice that proves it.
2. Inspect nearby code, tests, architecture docs, and relevant ADRs before editing.
3. Write or adjust a failing test first when behavior changes.
4. Implement the smallest behavior that makes the test pass.
5. Refactor only while the tests stay green.
6. Run the narrow test during iteration, then `npm run check` before handoff.
7. Update documentation when a public contract, user flow, architectural boundary, or operating procedure changes.

Prefer small, cohesive changes. Do not combine opportunistic refactors with feature work. Preserve unrelated user changes and never weaken a quality gate merely to obtain a green run.

## Concentric architecture

Dependencies point inward. Outer layers may know inner layers; inner layers must not know outer layers.

1. **Domain** — mahjong concepts, invariants, value objects, pure scoring rules. No React, Expo, storage, network, camera, clock, or analytics imports.
2. **Application** — use cases that coordinate domain behavior through explicit ports. No concrete platform SDKs.
3. **Ports** — small interfaces owned by the use case that needs them. Express capability, not vendor APIs.
4. **Adapters** — ONNX, camera, persistence, network, and device implementations of ports. Translate external failures into application-level results.
5. **Interface** — React screens and components. Invoke use cases and render state; do not contain scoring or recognition policy.

Rules:

- A React component must not calculate yaku, fu, payments, or tile legality.
- A domain function must not read global state, time, storage, environment variables, or network data.
- Camera frames and model tensors stop at adapter boundaries; application code receives domain-shaped recognition results.
- External input is untrusted. Parse and validate it at the boundary before creating domain values.
- Prefer dependency injection through function parameters or constructors. Avoid service locators and hidden singletons.
- Keep ports narrow. Split read and write capabilities when callers need only one.
- Use domain terminology consistently: tile, meld, indicator, winning tile, seat wind, round wind, han, fu, and payment.
- Add an ADR before reversing dependency direction, adding a runtime service, or adopting a major cross-cutting library.

## React and atomic design

React 19, React Native, React Native Web, and Expo Router are the presentation stack.

Shared UI follows atomic design as a dependency rule, not as a demand for excessive folders:

- **Tokens** — color, spacing, typography, motion, radius, and elevation decisions
- **Atoms** — indivisible controls and text treatments
- **Molecules** — small combinations that serve one interaction
- **Organisms** — meaningful product sections with local composition
- **Templates/screens** — information hierarchy, state orchestration, and route-level composition

Lower levels never import higher levels. Components receive domain-shaped data and callbacks rather than importing adapters. Keep a component local until reuse or consistency justifies promotion into `packages/ui`.

React conventions:

- Prefer function components, composition, controlled inputs, and explicit props.
- Keep render functions pure. Effects synchronize with external systems only.
- Derive values during render instead of mirroring them in state.
- Do not use an effect to handle an event that can be handled in the event callback.
- Model asynchronous screens with explicit discriminated states such as `idle`, `requesting`, `ready`, `failed`, and `complete`.
- Never ignore a promise. Handle it, await it, or deliberately mark it with `void` when the linter-approved fire-and-forget semantics are correct.
- Avoid broad context providers and global stores until state must genuinely cross route or feature boundaries.
- Route files stay thin and delegate to screens or use-case composition roots.
- Memoization is a measured optimization, not a default style.

## UI, UX, information architecture, and cognitive science

Design from the user's decision sequence, not from the database schema.

- Put the dominant job—scan a winning hand—first in visual and focus order.
- Use progressive disclosure for rare situational yaku and advanced rules.
- Favor recognition over recall: show tile faces, visible ruleset names, contextual examples, and current round state.
- Reduce choice at each step. Group related decisions and reveal them when relevant.
- Preserve context across corrections; never make a user restart a scan because one tile is wrong.
- Prevent errors before explaining them. Use capture guides, structural validation, sensible defaults, and constrained inputs.
- Make uncertainty visible and actionable. Confidence is not a decorative percentage; it should determine review behavior.
- Keep the locus of attention near the questionable tile or field.
- Provide immediate feedback for camera permission, blur, inference, validation, and scoring states.
- Make destructive or irreversible actions explicit and recoverable. Results and round advancement need undo.
- Do not rely on color alone. Pair color with shape, text, iconography, or position.
- Use plain language first and mahjong terminology second when onboarding; preserve precise terminology in score explanations.
- Respect reduced-motion preferences and avoid motion that delays task completion.
- Target WCAG 2.2 AA on web and equivalent native accessibility semantics.
- Interactive targets should be at least 48 by 48 logical pixels where layout permits.
- Every control needs an accessible name, state, focus behavior, and keyboard path on web.
- Test narrow phones, large text, landscape where supported, desktop keyboard use, screen readers, reduced motion, and high contrast.

The visual direction is a modern Japanese scoring ledger: warm paper, sumi ink, restrained vermilion, precise grid rhythm, and tile-like geometry. Avoid generic dashboard styling, gratuitous gradients, decorative glass effects, and novelty that competes with score verification.

## TypeScript quality

- Keep strict mode and the additional safety flags in `tsconfig.base.json` enabled.
- Do not use `any`. Start with `unknown` at boundaries and narrow deliberately.
- Prefer discriminated unions for state and results over boolean combinations.
- Make invalid states unrepresentable where practical.
- Use readonly inputs and return values for domain operations.
- Use `satisfies` when checking a value without widening its inferred type.
- Exhaustively handle domain unions; an unhandled case should fail type checking.
- Avoid non-null assertions. Prove the value exists or return a typed failure.
- Do not throw for expected user or recognition outcomes. Return explicit result types. Throw for programmer errors and impossible invariant breaches.
- Export the smallest stable surface from each package `index.ts`. Do not import another package's private paths.
- No default exports except framework-required route and configuration files.
- Names describe intent. Avoid `utils`, `helpers`, `manager`, `data`, and `common` as architectural buckets.
- Comments explain why, constraints, provenance, or surprising tradeoffs—not syntax.

## TDD and valuable tests

Use red-green-refactor for scoring rules, recognition post-processing, state transitions, and defect fixes. A test must be capable of failing for a meaningful product regression.

Test through stable behavior:

- Domain tests call public functions and assert decisions, invariants, and money/point outcomes.
- Component tests interact through accessible roles and names, then assert user-visible state or outgoing intent.
- Integration tests exercise a real use case with lightweight in-memory adapters.
- End-to-end tests cover only critical cross-platform journeys.

Avoid low-value tests:

- Do not assert private functions, implementation call order, CSS/StyleSheet internals, or framework behavior.
- Do not add snapshots for large trees or score objects. Small, reviewed snapshots are acceptable only when the representation itself is the contract.
- Do not mock pure domain collaborators. Use real domain code.
- Mock only boundaries that are slow, nondeterministic, destructive, unavailable, or outside our control.
- Prefer hand-written fakes over deeply configured mocks for ports.
- Do not use arbitrary sleeps. Control clocks and completion signals.
- Do not chase line coverage with assertions that cannot detect a defect.

For every behavior, cover the highest-value representatives:

- Happy path
- Boundary values and rounding transitions
- Invalid input and impossible states
- Ambiguous scoring decompositions
- Ruleset differences
- Failure, retry, cancellation, and permission denial at external boundaries
- A regression example for each production defect

Use generated/property tests for broad scoring invariants once the base engine exists. Use mutation testing selectively on the scoring core to reveal assertions that execute code without protecting behavior.

## Test pyramid

Maintain a deliberate pyramid:

1. **Many fast unit tests** for domain scoring, tile normalization, validation, and vision post-processing.
2. **Fewer component and use-case integration tests** for correction, context entry, permissions, and score presentation.
3. **A small number of end-to-end tests** for scan-to-score, manual-entry-to-score, session advancement, and offline recovery.

Most defects should be reproduced at the lowest layer that can express them. Do not move a domain rule into an end-to-end test merely because E2E appears more realistic.

Coverage floors are guardrails, not goals. New or changed scoring code should normally have complete branch coverage because every branch represents a rules decision. Review uncovered behavior and test design rather than lowering thresholds.

## Privacy, security, and trust

- Scoring and inference are local by default.
- Never upload a captured image without explicit, specific consent.
- Strip metadata and minimize retention for consented training examples.
- Do not log photos, tile crops, player names, access tokens, or full game histories.
- Store only what the product needs and provide deletion controls.
- Treat model output as untrusted input and validate it before scoring.
- Pin dependencies through the lockfile and investigate security advisories; do not apply blind breaking upgrades.
- Keep secrets out of source, Expo public configuration, fixtures, screenshots, and test output.

## Performance work

Fast feedback is a product and engineering requirement. When application, build, lint, or test work becomes noticeably slow, run a focused optimization pass instead of normalizing the delay.

1. Measure and record a reproducible baseline on the same machine and workload.
2. Identify the dominant cost with the appropriate profiler, timing output, bundle report, or test reporter.
3. Optimize one bottleneck at a time and keep the change small.
4. Re-run correctness checks and compare the same benchmark.
5. Keep the optimization only when the improvement is material and test value, debuggability, accessibility, and architecture are preserved.

For app performance, inspect startup, interaction latency, camera-frame work, memory, model initialization, bundle size, and unnecessary React renders. Move CPU-heavy inference and image preprocessing off the UI thread where supported. Do not memoize blindly.

For tooling performance, use Oxlint rule timings, Vitest/Jest slow-test reporting, dependency caching, scoped test commands, and build profiling. Split suites by responsibility before adding concurrency. Never remove valuable assertions, collapse isolation, disable type-aware linting, or weaken coverage merely to make the pipeline faster. Document durable benchmark scripts and performance budgets when a bottleneck becomes important enough to optimize repeatedly.

## Definition of done

A change is done when:

- The user outcome is complete, including empty, loading, failure, and recovery states where relevant.
- Architecture boundaries and accessibility requirements are respected.
- Tests protect the new behavior and would fail under a plausible regression.
- `npm run check` passes.
- `npm run build:web` passes for changes that affect the client or shared runtime code.
- Documentation and ADRs are current.
- No unrelated files, generated artifacts, secrets, or debug logging are included.

When a dependency, emulator, camera, signing identity, dataset, or external decision blocks verification, state exactly what was verified and what remains unverified.
