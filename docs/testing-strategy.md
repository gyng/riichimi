# Testing strategy

## Purpose

Tests protect product decisions and scoring correctness. They are not a census of implementation lines.

## Pyramid

### Unit tests

Most tests belong here. Cover domain invariants, scoring decisions, rounding boundaries, hand decompositions, ruleset switches, and deterministic recognition post-processing with Vitest.

### Component and use-case integration tests

Use Jest Expo and React Native Testing Library for meaningful interactions through accessible roles and names. Use real use cases with in-memory adapters where practical. Cover correction, permission denial, context entry, retry, and result explanation.

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
