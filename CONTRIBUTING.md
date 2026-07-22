# Contributing

Keep changes small, behavior-focused, and aligned with the inward dependency rules in `docs/architecture.md`.

1. Create or update the smallest test that expresses the intended behavior.
2. Implement the behavior without crossing an architecture boundary.
3. Run the narrow test while iterating.
4. Run `npm run check` before requesting review.
5. Run `npm run build:web` when client or shared runtime code changes.
6. Update documentation or add an ADR when a durable design decision changes.

Commit generated `package-lock.json`, but do not commit `.expo`, `dist`, coverage, logs, captured hands, or model training data. Never weaken a lint rule, type-safety option, test, or coverage floor without explaining the underlying design problem in the change.
