# react-native-web removal: done

Status: **complete** (2026-07-25). What was decided and why is recorded in
[ADR 0004](decisions/0004-web-only-dom-primitives.md); this file keeps the
execution notes and what is deliberately left.

## What shipped

- `react-native`, `react-native-web`, and `react-native-safe-area-context` are
  gone from `package.json` and the lockfile. No source file imports them.
- `packages/ui/src/primitives/` holds the DOM primitives (`View`, `Text`,
  `Pressable`, `ScrollView`, `TextInput`, `Image`, `ActivityIndicator`,
  `useWindowDimensions`) plus `resolveStyle` and the base resets, with unit tests
  for both.
- `StyleSheet.create` is gone: style blocks are `{ … } satisfies Styles`.
- Accessibility is authored as DOM attributes (`role`, `aria-*`). The RN props
  that react-native-web silently dropped were removed or replaced with the ARIA
  that actually renders.
- The celebration stamp runs on the Web Animations API.
- Component tests are Vitest + jsdom through `apps/client/vite.config.ts`. Jest,
  Jest Expo, `@testing-library/react-native`, and the `.svg` stub are gone.
- Every Expo package went with it, along with `app.json`, `app.config.js`,
  `expo-env.d.ts`, and `onnxruntime-react-native`. The four shims that had been
  aliased over `expo-router`/`expo-camera`/`expo-image-picker` are now ordinary
  adapters (`src/navigation/router`, `src/infrastructure/camera`,
  `src/infrastructure/photo-library`); `expo-asset` was ceremony over a URL the
  bundler already produced. `vite.config.ts` aliases nothing.

Entry bundle: 1,274,035 → 973,750 bytes (-24%). Lockfile: 850 → 335 packages,
which is what finally took `react-native` out of the install tree — it had been
surviving as a transitive peer of `expo`.

## Gotchas worth remembering

- **`lineHeight`.** React reads a bare number as a multiple of the font size;
  these styles mean pixels. `resolveStyle` converts it.
- **Shorthand resets.** React clears a style property that disappears between
  renders by assigning `""`, which detaches it from any shorthand and reverts it
  to its CSS initial. `border: 0 solid black` in the base reset therefore painted
  a 3px black frame (`medium`) on nodes React reused. Base resets use longhands;
  `base-style.test.ts` locks that in.
- **`flexBasis` is main-axis.** A card styled for a wrapping row (`flexBasis: 320`)
  turns that into a 320px _height_ in a column, and its contents spill over the
  next panel. The rules card is placed in a row wrapper on the table screen.
- **`fontFamily: "monospace"`.** A lone `monospace` keyword makes browsers switch
  to their own fixed-pitch size; `resolveStyle` names it twice, as
  react-native-web did.
- **jsdom.** No `matchMedia`, no `Element.animate`, no image decoding. The shared
  setup stubs the first; the primitives feature-detect the second; the scan test
  reports a size for the third.

## Deliberately left

- **Approach B (idiomatic DOM).** The primitives keep RN-shaped names and style
  objects. Converting components to `div`/`span` with CSS Modules is now
  unblocked and can go one component at a time.
- **`paddingHorizontal` and friends** are still the authored form, expanded by
  `resolveStyle`. Renaming them to CSS logical properties is cosmetic.
- **`fontWeight: "700"`** stays quoted at ~85 sites; `Style` widens the type to
  accept it. Numeric weights would be more idiomatic.
- **Accessible names are English.** `aria-label` copy does not go through the
  translator, and the i18n scanner deliberately does not cover it — closing that
  needs catalog entries in every locale. See `src/i18n/coverage.test.ts`.
- **Safe-area insets.** `SafeAreaView` was a zero-inset passthrough and is gone.
  Honouring `env(safe-area-inset-*)` on notched devices would be a new behaviour,
  not a restoration.
