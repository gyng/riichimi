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
  setup stubs the first; the celebration feature-detects the second; the scan test
  reports a size for the third.
- **A border with no style paints nothing.** `border-width` alone is invisible
  because `border-style`'s initial value is `none`, and the JS reset that used to
  supply `solid` is gone. Every converted border sets all three.
- **`flexBasis` is main-axis.** A card sized for a wrapping row turns that basis
  into a height in a column. `min-width` says the same thing in both.

## Done in the follow-up pass

The primitives are gone. Every component renders DOM elements and styles itself
through a co-located CSS module, with tokens as custom properties in
`tokens.css`. `:active` and `:disabled` replaced the JS pressed and disabled
styles, media queries replaced the measured-width layouts, and the remaining
deferred items closed with it:

- **`paddingHorizontal`, quoted `fontWeight`, `lineHeight` in pixels** all went
  away with the style objects — they are ordinary CSS now.
- **Literal accessible names are translated** in all four locales, and the i18n
  scanner covers `aria-label` and `accessibilityLabel` so the gap cannot reopen.
- **Safe-area insets** are honoured once, in the app shell: the header takes the
  top inset, the body the sides and bottom.
- **The client's coverage floors are a gate**, not dormant config: `test:ui` runs
  with `--coverage`.

## Still left

- **Composed accessible names.** A name built from a tile, a player, or a count
  ("Remove 5 circles from hand") is still English. Translating those needs an
  interpolating translator and a locale-aware `tileAccessibleName` — a feature
  with its own design, not a catalog entry. The scanner reads literals only, and
  a test pins that boundary.
- **A `Checkbox` component.** Four features compose the same checkbox from shared
  CSS. The markup is still repeated, and reuse now justifies promoting it.
- **`aria-labelledby` over `aria-label`.** Several controls sit under a visible
  label and name themselves again with `aria-label`, so the same string is
  translated twice. Pointing at the visible label would leave one.
