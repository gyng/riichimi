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

The domain has no knowledge of React, Expo, cameras, ONNX, persistence, analytics, HTTP, or the current time. The application layer coordinates domain behavior and declares the capabilities it needs as ports. Platform code implements those ports. React translates user intent into use-case calls and renders explicit application state.

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

Owns reusable DOM UI using atomic design, over the primitives in `src/primitives/` that wrap `div`, `span`, `button`, and `input` and resolve style objects to CSS. It may depend on React and consume domain-shaped props. It does not import device adapters or implement scoring policy.

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
