# Dependency policy

Last reviewed: **2026-07-25**

## Minimum release age

A dependency is not adopted until its version has been published for **at least
seven days**. A freshly published release is where a compromised package first
appears; a week of exposure is enough for most such releases to be caught and
pulled. Dependabot enforces this through `cooldown.default-days` in
[`.github/dependabot.yml`](../.github/dependabot.yml). A manual bump follows the
same rule — check the publish date on the registry before pinning.

This changes what "latest" means. When this policy was written, React's latest
was 19.2.8, published three days earlier; the version this rule would install was
19.2.7. That is the intended behaviour, not a limitation to work around.

## No SDK owns these packages

React, React DOM, and the browser packages are pinned by the lockfile alone. The
Expo SDK used to pin `react`, `react-dom`, `react-native`, and friends to the
exact versions its native runtime was built against; with React Native removed,
nothing outside this repository has a say, and `react`/`react-dom` are no longer
held back in the Dependabot config.

Four `expo-*` packages remain as dependencies. Every one of them is aliased to a
web shim under `apps/client/web/shims/` at build time, so they are type surfaces
rather than shipped code; they are grouped in Dependabot so they move together.

## Checking the tree

`npm ls --workspaces` reports what is actually installed, and `npm run check`
plus `npm run build:web` are the real gate: a browser-only tree has no
out-of-band version authority to reconcile against.
