# Handoff plan: remove react-native-web (full DOM/CSS rewrite)

Status: **not started** (planning only). The Vite web-only migration and the
react-native-svg removal are done and green; this is the next, larger step.

## Goal

Remove the `react-native` / `react-native-web` dependency from the client so the
UI is plain DOM + CSS. Note up front: **react-native-web is already a pure web
library** — nothing native is bundled today. This task is about the codebase
*idiom* (div/span/button/CSS instead of View/Text/StyleSheet), not about
removing native code (that's already gone).

## Current state (baseline to protect)

- Branch/commit: `main` @ `0e1e789` (local; `origin/main` unpushed).
- `npm run check` and `npm run build:web` are green. App verified end-to-end in
  the browser (home, manual+scoring, scan+recognition, history) on both the dev
  server and the production build.
- Presentation stack: React 19 + react-native-web 0.21 + react-router 7, bundled
  by Vite. Tiles already render as plain DOM `<svg>` (svgr, no react-native-svg).
- Platform code splits were removed (`.web.ts` → base, `.native.ts` deleted).

## Scope (measured)

- **27 non-test source files** import `react-native` (full list below).
- **~502 `Text`, ~357 `View`, 91 `Pressable`, 24 `StyleSheet.create` blocks,
  9 `Animated` (celebration only), 20 `ScrollView`, 4 `TextInput`, 7 `Image`.**
- **14 test files** use `@testing-library/react-native` (must move to
  `@testing-library/react` + jsdom, since components become DOM).
- Also in play: `useWindowDimensions` (3), `Platform` (1), `SafeAreaView` shim,
  `AccessibilityInfo` (2).

### Files importing `react-native` (rewrite targets)

packages/ui: `atoms/action-button`, `atoms/mahjong-tile`, `atoms/section-label`,
`molecules/counter-control`, `molecules/method-card`, `molecules/segmented-control`,
`organisms/calculator-landing`, `organisms/top-app-bar`.

apps/client/web: `root-layout`, `shims/expo-camera`, `shims/safe-area`.

apps/client/src/features: `announcer/announce-control`,
`celebration/celebration-banner`, `i18n/language-control`,
`manual-calculator/manual-calculator`, `manual-calculator/score-result-panel`,
`manual-calculator/tile-picker`, `recognition/recognition-review-panel`,
`recognition/tile-bounds-overlay`, `rules/house-rules-editor`,
`rules/rules-profile-control`, `rules/tile-label-control`.

apps/client/src/screens: `home-screen`, `scan-screen`, `score-history-screen`,
`session-screen`, `settings-screen`.

## Recommended approach

Two viable paths; **Approach A is recommended** — it removes the dependency (the
concrete goal) with far less risk and keeps the app green throughout. Approach B
is optional polish afterward.

### Approach A — local DOM primitives (recommended)

Build a small primitives module in `packages/ui/src/dom/` that renders RN-shaped
props to DOM, then repoint all 27 imports from `react-native` to it. This deletes
the react-native-web dependency in one bounded, testable place instead of
hand-editing 850+ JSX elements.

Primitives to implement (thin, typed, DOM):

| RN | DOM impl | Notes |
|----|----------|-------|
| `View` | `div` | **Must default to `display:flex; flex-direction:column`** — RN's default. This is the #1 layout gotcha; a bare `div` is `display:block`. |
| `Text` | `span` (block-ish) | RN text doesn't wrap-inherit; set `white-space:pre-wrap` where `\n` is used. |
| `Pressable` | `button type=button` | `onPress`→`onClick`; map `disabled`; keyboard focus is free. Accepts a render-prop/child. |
| `ScrollView` | `div` | `overflow:auto`; `contentContainerStyle`→inner wrapper. |
| `TextInput` | `input`/`textarea` | `value`/`onChangeText`→`onChange`. |
| `Image` | `img` | `source={{uri}}`→`src`; `resizeMode`→`object-fit`. |
| `StyleSheet.create` | identity fn | returns the object as-is; keep a `normalizeStyle` step (below). |
| `StyleSheet.absoluteFillObject` | `{position:'absolute',inset:0}` | |
| `Platform` | `{ OS:'web', select: o => o.web ?? o.default }` | |
| `useWindowDimensions` | `resize`-listening hook | |
| `Animated` | see below | celebration only |

**Style normalizer** (the real work): RN style objects are ~90% CSS but need:
- `marginHorizontal/Vertical`, `paddingHorizontal/Vertical` → expand to
  left/right/top/bottom.
- `textShadowColor/Offset/Radius` → `textShadow` string.
- `shadowColor/Offset/Opacity/Radius` / `elevation` → `boxShadow`.
- numeric values → React DOM adds `px` automatically for most props (OK).
- array styles `[a, b && c]` → merge (RN merge semantics: later wins).
- Apply the normalizer inside each primitive so callers keep passing `style={...}`.

Accessibility prop mapping (do in the primitives): `accessibilityRole`→`role`,
`accessibilityLabel`→`aria-label`, `accessibilityState={{checked,disabled,...}}`→
`aria-checked`/`aria-disabled`, `accessibilityLiveRegion`→`aria-live`,
`accessibilityElementsHidden`/`importantForAccessibility='no-hide-descendants'`→
`aria-hidden`, `accessibilityHint`→`aria-description`, `nativeID`→`id`. Many are
already dual-authored with `aria-*` in this codebase — verify per file.

Then: repoint imports (`from "react-native"` → the local module), run
`npm run check`, fix fallout, and finally remove `react-native`,
`react-native-web`, `react-native-safe-area-context`, and the `expo-*` shim
aliases that only exist to bridge RN (keep the ones the app still calls). Delete
the `react-native` alias in `vite.config.ts`.

### Approach B — fully idiomatic DOM (optional, later)

Hand-convert each component's JSX to `div`/`span`/`button` with CSS Modules
(Vite supports `*.module.css` natively) or co-located inline styles. Higher
effort (~1–2 weeks), no `View`/`Text` indirection. Do this only after A, one
component at a time, tests green between each.

## The hard parts

- **Celebration `Animated`** (`features/celebration/celebration-banner.tsx`): uses
  `Animated.Value`, `Animated.timing`, `interpolate`, `Animated.View`. Reimplement
  with the Web Animations API (`element.animate`) or CSS `@keyframes` driven by
  the same timeline fractions. The WebGL overlay (`celebration-overlay.tsx`) and
  the chime (`chime.ts`) are already DOM/Web-Audio — leave them. Respect
  `prefers-reduced-motion` (already handled) and keep the char-by-char reveal
  timing identical.
- **`SafeAreaView`** (`web/shims/safe-area.tsx`): already a passthrough — collapse
  into the `View` primitive (insets are zero on web).
- **`root-layout.tsx` / `expo-camera.tsx`**: already mix DOM (`<video>`) with RN
  `View`; straightforward once `View` is a div.
- **`manual-calculator.tsx`** is the largest screen (~1400 lines) — convert last,
  lean on the primitives so the diff is mostly import + tag swaps.

## Test migration (14 files)

- Swap `@testing-library/react-native` → `@testing-library/react`; render into
  jsdom. `getByRole`/`getByText` queries mostly carry over since the primitives
  set proper ARIA roles. `fireEvent.press` → `fireEvent.click`.
- Decide the runner: either keep Jest (add `jest-environment-jsdom`, drop the
  `jest-expo` preset) **or** move component tests to Vitest + jsdom (aligns with
  the existing `test:unit`). Vitest is the cleaner long-term target; update
  `apps/client/jest.config.cjs` / `package.json` accordingly and the
  `svg-mock` (can become a real DOM svg or stay a stub).
- `tests/ui-primitives.test.tsx` will need the most attention — it asserts
  primitive behavior directly.

## Suggested order (keep `npm run check` green after each step)

1. Primitives module + style normalizer + unit tests for the normalizer.
2. Atoms (4) → repoint + verify.
3. Molecules (3) → organisms (2).
4. Feature components (11), leaving `manual-calculator` for last.
5. Screens (5).
6. `root-layout`, `safe-area` (fold into View), `expo-camera` (View→div).
7. Celebration `Animated` → WAAPI.
8. Test files → `@testing-library/react`; pick the runner.
9. Remove deps (`react-native`, `react-native-web`, `react-native-safe-area-context`),
   drop the `react-native`/safe-area aliases in `vite.config.ts`, delete the
   safe-area shim. Update `AGENTS.md` (presentation stack line) and this doc.

## Definition of done

- No `from "react-native"` imports anywhere; `react-native`/`react-native-web`
  removed from `package.json` and lockfile.
- `npm run check` and `npm run build:web` green.
- Browser re-verification of all five screens + the celebration + scan
  recognition, on dev server and production build.
- Tokens (`packages/ui/src/tokens/theme.ts`: `color`, `space`, `radius`)
  preserved; the paper/ink ledger visual unchanged.

## Open decisions for the next session

1. Approach A (primitives, recommended) vs B (idiomatic DOM) — or A then B.
2. Component test runner: Jest+jsdom vs migrate to Vitest+jsdom.
3. Styling: inline normalized style objects vs CSS Modules (if/when doing B).
