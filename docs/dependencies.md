# Dependency policy

Last reviewed: **2026-08-02**

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

No `expo*` or `react-native*` package is installed. The camera, photo library,
and navigation adapters that used to be shims behind an alias are ordinary
modules under `apps/client/src/`, so the install tree contains only what the
browser build actually runs.

## React must resolve to exactly one copy

`react` and `react-dom` are pinned to the same exact version in every workspace
that declares them, and root `overrides` holds the whole tree to it. Two copies
of React do not fail loudly — hooks read a null dispatcher and every component
test dies with `Cannot read properties of null (reading 'useRef')`, which reads
like a broken component rather than a broken install.

This is not hypothetical. `packages/ui` pinned `react` one patch behind the
client, so npm hoisted that version to the root and nested the client's own copy
underneath it. The component suite imported `@riichimi/ui` and got the root copy
while the client code got the nested one: 50 tests failed at once. Bump them
together or not at all.

## `cookie-es` is declared, but nothing imports it

`react-router` 8 depends on `cookie-es` for its server runtime. npm does not
install that dependency in this workspace — it resolves correctly in a minimal
workspace and standalone, so the cause is local to this tree rather than to
react-router — and the build then fails to resolve the import, because
resolution happens before the unused server runtime is shaken out.

`apps/client` therefore declares `cookie-es` itself. **Do not remove it as an
unused dependency.** It is a workaround for a resolution failure, not a
capability the client uses; Riichimi is a client-only SPA and never runs the
server runtime. Drop it once a plain `npm install` puts `cookie-es` in the tree
on its own.

## Checking the tree

`npm ls --workspaces` reports what is actually installed, and `npm run check`
plus `npm run build:web` are the real gate: a browser-only tree has no
out-of-band version authority to reconcile against.

`npm audit` runs clean as of 2026-08-02. The previous finding was a high-severity
`react-router` advisory (`GHSA-qwww-vcr4-c8h2`, RSC-mode CSRF bypass) covering
7.12.0–8.2.0. It was unreachable here — the app has no RSC mode, no server, and
no actions — but the fix was a version bump rather than an exception, so it was
taken: `react-router-dom` 7.18.1 became `react-router` 8.3.0. Version 8 drops the
`react-router-dom` package entirely and requires React 19.2.7 or newer, which is
what moved `react`/`react-dom` to 19.2.8.
