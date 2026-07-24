# Dependency policy

Last reviewed: **2026-07-24**

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

## The Expo SDK owns its packages

React, React DOM, `react-native`, `react-native-safe-area-context`, and
`react-native-svg` are pinned by the Expo SDK to the exact versions its native
runtime was built against. `npx expo install --check` is the source of truth,
and it fails on any other version. These packages move only when the SDK moves.

Dependabot has no knowledge of that pin, so a standalone bump of React only
produces a red PR. `react` and `react-dom` are therefore ignored in the
Dependabot config, and the SDK-managed set is updated with `expo install` when
the SDK is upgraded, not toward npm-latest.

## The toolchain can block a major

`jest-expo` 57 is built on jest 29 internals (`@jest/globals`, `babel-jest`, and
`jest-environment-jsdom` at `^29`). jest 30 cannot be adopted until `jest-expo`
supports it, whatever npm reports as latest. The jest major is held in the
Dependabot config until then; patches within 29 are still taken.

## Checking the tree

`npx expo install --check` from `apps/client` reports any package that has
drifted from its SDK-expected version. Run it after adding or changing a native
or SDK-managed dependency — it caught `react-native-svg` sitting one patch ahead
of the SDK after the tile-art work.
