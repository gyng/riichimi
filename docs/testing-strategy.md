# Testing strategy

## Purpose

Tests protect product decisions and scoring correctness. They are not a census of implementation lines.

## Pyramid

### Unit tests

Most tests belong here. Cover domain invariants, scoring decisions, rounding boundaries, hand decompositions, ruleset switches, and deterministic recognition post-processing with Vitest.

### Component and use-case integration tests

Use Vitest with jsdom and React Testing Library for meaningful interactions through accessible roles and names. These run through the app's own Vite config, so a screen resolves its shims and tile art in a test exactly as it does in the browser. Use real use cases with in-memory adapters where practical. Cover correction, permission denial, context entry, retry, and result explanation.

### End-to-end tests

Keep a small cross-platform suite for critical journeys:

- Guided capture to confirmed score
- Manual hand entry to confirmed score
- Offline scoring after model installation
- Game result to score transfer and round advancement
- WebMCP discovery, visible mutation, and undo

Do not duplicate every scoring example at this layer.

The current Playwright browser suite performs two dogfood rounds: one mobile-width journey through WebMCP and one desktop journey through visible controls. The mobile round includes a table-linked score, exact transfers, dealer repeat, and persisted history; the desktop round proves camera-permission recovery, a real browser file chooser, real ONNX inference, mandatory review, 15 explicit tile corrections against the visible photograph, and reviewed handoff to scoring. Dated screenshots are evidence, not assertion snapshots; behavior is asserted through roles, names, state, URLs, and structured tool results.

Recognition model manifests are tested as domain policy. Tests independently protect artifact integrity, provenance, complete class coverage, evaluation-set size, per-tile accuracy, and exact-hand accuracy. A passing metadata test does not replace real-corpus or device evaluation.

## TDD loop

1. Express one observable behavior with a failing test.
2. Confirm it fails for the expected reason.
3. Implement the smallest passing behavior.
4. Refactor names, boundaries, and duplication with the test green.
5. Add another example only when it protects a distinct risk.

## Test design

A valuable test has a clear reason to fail. Prefer representative partitions and boundaries over exhaustive duplication. For scoring, prioritize ambiguous decompositions, fu transitions, limit boundaries, dealer/non-dealer payments, open/closed distinctions, special hands, and rule-profile differences.

Assertions should describe outcomes, not implementation choreography. Avoid broad snapshots, mock-heavy domain tests, private-function tests, index-based UI queries, arbitrary waits, and coverage-only assertions.

## Coverage

Coverage floors reveal unexamined code, but 100% execution does not prove correctness. New scoring branches normally require complete branch coverage because each branch represents policy. Use mutation testing selectively once scoring behavior is substantial to detect tests with weak assertions.

## Defects

Every defect fix starts with the smallest reproducing test at the lowest suitable layer. The test should fail before the fix and stay as a permanent regression example.

## What the gate enforces

`npm run check` runs formatting, linting, **type checking**, the domain suite with
coverage floors, and the component suite with its own floors. Type checking was
added after 37 module-resolution errors survived a green run: oxlint's type-aware
rules are not a substitute for `tsc`, and the two now both run.

Both suites are gated on coverage. The client's floors live in
`apps/client/vite.config.ts`; they had been dormant since the Jest configuration
they were ported from ran without `--coverage`, so a drop in the component suite
could not fail anything. `test:ui` now asks for coverage, which costs about 1.5
seconds. `npm run test --workspace @riichimi/client` still runs the suite without
it for a fast local loop.

## Coverage floors, and what is deliberately not chased

Floors are a ratchet against regression, not a target. They sit just under what
the suite reaches, so a drop fails the gate and a gain can be locked in.

Domain packages sit near complete. The statements that remain uncovered are two
kinds, and both should stay that way:

- **Compiler-mandated guards.** `noUncheckedIndexedAccess` forces an `undefined`
  check on an index that the surrounding loop bounds already guarantee. Reaching
  them needs an input the type system forbids.
- **Exhaustiveness defaults.** `const exhaustive: never = event` exists so a new
  variant fails to compile. Calling it requires casting past the type that makes
  it work.

Faking either produces a test that executes a line and proves nothing.

The client's floors are lower and split by area on purpose:

- **Components, i18n, recognition** are held high. Behaviour lives there.
- **Platform adapters and the WebMCP bridge** are held to the global ratchet.
  They wrap ONNX, browser storage, and the model-context API, so a unit
  test would mostly assert that a mock was called. The browser dogfood drives all
  three for real — the WebMCP journey executes the actual tools, and the scan
  journey runs the actual model — which is worth more than a mocked line count.

## Translation coverage

`src/i18n/coverage.test.ts` scans the source tree for user-facing literals that
do not go through `t`. It is checked against a deliberately introduced string to
confirm it fails when copy is missed, because a scanner that cannot fail is
decoration.
