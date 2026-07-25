# ADR 0004: A web-only client on DOM primitives

Status: accepted (2026-07-25). Supersedes the client-stack and test-runner parts
of [ADR 0001](0001-react-expo-oxc.md); its React, TypeScript 7, and Oxc decisions
stand.

## Context

ADR 0001 chose React Native, React Native Web, and Expo Router so one codebase
could serve Android, iOS, and the browser, with Jest Expo for component tests.
Only the browser was ever shipped. The Expo/metro toolchain was retired in favour
of Vite, and the platform splits and `react-native-svg` were removed, which left
`react-native-web` as the last piece of the native stack: a pure-web library
translating `View`/`Text`/`StyleSheet` into DOM and CSS for a target that is only
ever the DOM.

That indirection cost something real. It shipped ~300 KB of translation layer to
every visitor; it silently dropped props the code was authoring (`accessibilityState`
on 23 controls, `accessibilityElementsHidden`, `hitSlop`, `resizeMode` in a style
object); and it made the tests run against a _different_ renderer than production,
because Jest Expo resolves `react-native`, not `react-native-web`.

## Decision

- The client is web-only. `react-native`, `react-native-web`, and
  `react-native-safe-area-context` are removed.
- Keep the RN-shaped component names — `View`, `Text`, `Pressable`, `ScrollView`,
  `TextInput`, `Image`, `ActivityIndicator` — as a thin local layer in
  `packages/ui/src/primitives/`, below tokens in the atomic hierarchy. Each is a
  single DOM element plus a documented reset. Renaming 850+ elements would have
  been churn with no user-visible result.
- Style objects stay the authoring form. `resolveStyle` collapses a `style` prop
  into CSS: it flattens arrays, expands the non-CSS shorthands
  (`paddingHorizontal` and friends), reads a bare `lineHeight` as pixels, and
  makes a specific property beat a broad one whatever the key order. This is the
  one place RN-to-CSS semantics live, and it is unit-tested.
- Base resets are written as longhands, never shorthands whose CSS initial value
  differs from the reset. React clears a style property that disappears between
  renders by assigning `""`, which detaches it from any shorthand and reverts it
  to its initial — `border: 0 solid black` became a 3px black frame that way.
- Accessibility is authored as DOM: `role`, `aria-label`, `aria-live`,
  `aria-hidden`, `aria-pressed`, `aria-current`. `Pressable` renders a real
  `<button>`, so keyboard activation, the focus ring, and `disabled` come from
  the browser.
- Component tests run on Vitest with jsdom through the app's own Vite config, so
  a screen resolves its shims and tile art exactly as it does in the browser.
  Jest, Jest Expo, and React Native Testing Library are removed.
- The celebration timeline runs on the Web Animations API off one eased
  timeline shared by every element, replacing `Animated`.

## Consequences

The entry bundle drops from 1,274 KB to 974 KB (-24%) with no change to what the
app does. Tests exercise the shipped renderer, which immediately surfaced real
defects: a mock that had drifted from its port, and accessible state that was
being authored but never rendered. Accessibility improves where those dropped
props now reach the DOM.

The cost is a small layer we own rather than a dependency we upgrade: about 200
lines across the primitives and the style resolver. The names still read as React
Native, which is a deliberate trade — converting each component to `div`/`span`
with CSS Modules remains possible, one component at a time, and is no longer
blocked by anything.

Four `expo-*` packages (`expo-router`, `expo-camera`, `expo-asset`,
`expo-image-picker`) survive as build-time aliases to web shims. Removing them
means replacing an import path, not a runtime, and is deferred.
