# Architecture

## Direction of dependency

Riichimi uses concentric architecture. Code dependencies point toward stable mahjong policy.

```text
React screens and routes
          ↓
Application use cases ← ports ← camera / ONNX / storage / WebMCP adapters
          ↓
Mahjong domain and scoring rules
```

The domain has no knowledge of React, the DOM, cameras, ONNX, persistence, analytics, HTTP, or the current time. The application layer coordinates domain behavior and declares the capabilities it needs as ports. Platform code implements those ports. React translates user intent into use-case calls and renders explicit application state.

## Workspace responsibilities

### `packages/score-core`

Owns tiles, melds, hands, invariants, decomposition, yaku, fu, limits, and payment policy. It must remain deterministic and framework-free.

### `packages/rules`

Owns named, versioned ruleset profiles and their provenance. A profile contains data; score behavior stays in `score-core`.

### `packages/session-core`

Owns four-player table state, riichi deposits, score transfers, exhaustive-draw settlement, dealer continuation, round progression, history, and undo transitions. Commands receive IDs and timestamps from the outer application so the package remains deterministic.

### `packages/vision`

Owns recognition-shaped domain contracts, ports, deterministic post-processing, and the model-release manifest gate. ONNX Runtime, camera/gallery APIs, artifact download, and caching belong in outer adapters, not this package's domain. A model is not eligible for adapter integration unless its immutable manifest proves provenance, full class coverage, valid tensor input, and minimum evaluation metrics.

### `packages/ui`

Owns reusable UI using atomic design, as `atoms/`, `molecules/`, and `organisms/` that render `div`, `span`, `button`, `input`, and real headings directly. Every component styles itself through a co-located `*.module.css`, and every colour, spacing step, radius, and font stack comes from a custom property in `tokens/tokens.css` — the one place those values are written. It may depend on React and consume domain-shaped props. It does not import device adapters or implement scoring policy.

### `apps/client`

Owns routes, screens, adapter composition, navigation, permissions, and browser-specific concerns. Route files are deliberately thin.

The browser client exposes a small typed WebMCP surface through `document.modelContext` when the host supports it. Tool definitions stay in the interface/infrastructure ring, call the same session and scoring actions as visible controls, and disappear automatically on unmount. WebMCP is progressive enhancement: unsupported or denied registration never impairs manual use.

## Scan data flow

1. A screen requests a camera capture or local gallery image after user intent.
2. The recognition adapter converts a frame into tile candidates with confidence and geometry.
3. Vision post-processing prioritizes uncertain candidates and proposes groups.
4. The correction use case applies confirmed changes and validates the hand.
5. The scoring use case evaluates the hand with a versioned rules profile.
6. The screen renders an auditable result and preserves corrections for recovery.

External failures are translated at adapter boundaries. Expected outcomes—permission denied, unknown tile, incomplete context, invalid hand, unsupported model—are typed states rather than exceptions.

Until a model clears the release gate, capture stops at an explicit photo-review state and carries the reference into manual entry. The interface never fabricates detections. See the [recognition model audit](recognition-model-audit.md).

## Localization

User-facing copy is localized at the interface ring only. `apps/client/src/i18n/`
holds a catalog keyed by the English source string, so wiring a screen is a
mechanical wrap and an untranslated key falls back to English rather than
rendering a key name. A test scans JSX text and `label`/`title`/`placeholder`
props for unwrapped strings, and accessible names composed at runtime are
translated through the same catalog as the visible text.

Domain vocabulary is deliberately outside that catalog. Yaku names and fu-audit
reasons originate in `score-core`, where importing an i18n layer would reverse
the dependency direction; ruleset profile names (TENHOU, EMA, JPML, WRC,
M.League) are proper nouns. Scoring _vocabulary_ around them is translated
(han → 翻, fu → 符). Localizing the domain-originated strings needs an
interface-layer dictionary keyed by stable yaku id, which is a feature rather
than a wrapping pass — see [rules profiles](rules-profiles.md).

## Audio

The win announcer speaks through a narrow speech port, so the voice backend is
swappable and no domain or application code knows which engine is present. Two
adapters implement it: the browser's own Web Speech voice, and a neural voice
(Kokoro 82M) that runs on the device. Only `speech-selection.ts` knows there is
more than one — callers hold a `SpeechPort` and never learn which answered.

The neural voice is **not installed and not bundled**. Its engine is imported
from a CDN at the moment a player selects it, and its weights come from the
Hugging Face hub. That is deliberate rather than convenient: bundling
`kokoro-js` puts a 21.6 MB ONNX WASM binary and 1.3 MB of JavaScript into every
deploy — six times the size of the whole app — for a voice that is off by
default, and installing it pulls `sharp` with high-severity libvips advisories
that have no fix. The engine is a download either way, so the code is one too.
The types it needs are declared in `kokoro-engine.ts`, and the module is
validated when it arrives, because code fetched over the network is external
input like any other.

This is the one place Riichimi is not local-first, and it is opt-in, off by
default, disclosed with its download size before the choice, and falls back to
the browser voice when the fetch fails.

Both kinds of win feedback are user-controlled and fail quiet. The voice is off
until switched on and reports `available: false` where no engine exists; the
celebration is on until switched off and drops to a still frame under
`prefers-reduced-motion: reduce`. Neither blocks or delays a score.

## Persistence

The client persists separate versioned session and score-history documents in browser local storage, behind module contracts that keep the storage choice out of the application layer. Stored JSON is narrowed from `unknown`—including nested score summaries—before entering application state. Recalculating the same standalone hand moves one deduplicated entry to the front of the 20-entry score folio. See ADR 0002.

## Agent interaction

WebMCP tools use strict JSON schemas and boundary parsers. Read-only tools are annotated and include score-folio inspection; mutating tools update visible UI and route through recoverable session actions. The app deliberately exposes no tool for silent table/history deletion, camera permission, or image upload. See ADR 0003.

## Static web delivery

Vite emits a single HTML document and `react-router` owns the routes inside it. The repository-owned static server falls back to that document for clean paths such as `/history`, matching the direct-link contract required from production hosting. Browser dogfood reloads a nested route to prevent client-navigation-only releases.

## Package API discipline

- Import only from another package's public export.
- Keep package exports small and intentional.
- Prefer pure functions and readonly values in inner layers.
- Introduce a port where policy would otherwise import a mechanism.
- Add an ADR for a new cross-cutting dependency or a change to dependency direction.
