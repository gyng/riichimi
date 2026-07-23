# Riichi Mahjong Score Calculator Plan

## Product goal

Build a mobile and web riichi mahjong calculator that turns a photo of a winning hand into a trustworthy score with as little manual input as possible.

## Implementation status — 2026-07-23

- Complete: deterministic WRC 2025 scoring, validation, decomposition, all listed yaku and yakuman, fu, limits, payments, and audit output.
- Complete: accessible manual tile/meld/indicator entry and context-aware scoring on mobile and web.
- Complete: a device-local, deduplicated 20-entry score folio with hand, context, yaku, payment, removal, clear confirmation, and reload recovery.
- Complete: local four-player sessions with riichi deposits, transfers, draws, dealer/round progression, history, recovery, deletion, and undo.
- Complete: camera permission/capture flow, camera and gallery photo review, Android pending-picker recovery, photo-reference manual fallback, recognition contracts, confidence review, structural checks, tile-by-tile correction, winner reassignment, and a hard no-score-until-reviewed transition.
- Complete: a tested model-release manifest gate for artifact integrity, provenance, input shape, full class coverage, evaluation size, and accuracy thresholds.
- Complete: persisted WRC 2025 and explicit red-five-table profiles drive the tile picker and scorer, migrate safely, and pin atomically to a table through reload and undo.
- Complete: progressive-enhancement WebMCP discovery and typed tools for app state, rules selection, navigation, manual scoring, score-history inspection, local table mutation, and undo, with visible browser dogfood coverage.
- Beta complete: a rights-traceable guided physical-tile locator/classifier runs offline on web and native adapters. V1 improves source-separated physical-crop top-1 from 73.91% to 93.48% and accepted coverage from 28.26% to 78.26%, with 100% accepted accuracy at the conservative threshold. Its [model audit](recognition-model-audit.md) records provenance, training, the 46-crop evaluation, and why it is not promoted to production accuracy. Pending evidence is a representative 500-hand corpus and real-device benchmarks—not an undisclosed model artifact.

The initial product should optimize for a guided winning-hand scan rather than unrestricted whole-table recognition. A camera can recognize tiles, melds, and indicators, but important scoring facts—such as riichi, ippatsu, round state, and how the hand was won—may not be visible. The target is therefore:

- Zero tile corrections for a typical guided scan
- One to three context taps when facts cannot be inferred
- A complete score within five seconds
- No silent scoring when recognition confidence is low

## Primary user flow

`Capture → recognize → review uncertainties → confirm context → score`

1. The user selects a ruleset once, or inherits it from an active game session.
2. A camera overlay guides the user to include:
   - Concealed tiles
   - Open melds and kans, separated spatially
   - The winning tile, placed slightly apart
   - Dora and ura-dora indicators
3. The app detects each tile, its orientation, red fives, meld grouping, and recognition confidence.
4. Low-confidence or structurally impossible results are outlined and advanced one by one through top-three suggestions or the complete tile picker. Scoring remains locked until all issues are resolved.
5. A compact context sheet asks only for missing facts:
   - Ron or tsumo
   - Round wind and seat wind, unless supplied by a game session
   - Riichi, double riichi, and ippatsu
   - Rare circumstances such as rinshan, chankan, haitei, houtei, tenhou, or chiihou
6. The app displays yaku, han, fu, limit, payments, and a plain-language explanation.

## Product scope

### MVP: trustworthy manual calculator

- Optimized manual tile entry as a universal fallback
- Ron and tsumo scoring
- Open and closed melds, including all kan types
- Red fives, dora, and ura-dora
- Standard hands, chiitoitsu, kokushi, and yakuman
- Complete fu, han, limit, and payment breakdown
- Clear validation for impossible or incomplete hands
- Versioned, configurable rules profiles
- Responsive mobile and web interface
- Local history for recent calculations

Start with one precisely documented rules profile. WRC 2025 is a suitable international baseline, followed by common Japanese casual and online-platform variants. Riichi rules vary in options such as red fives, open tanyao, kiriage mangan, kazoe yakuman, double yakuman, and responsibility payments, so these choices must live in data-driven rules profiles rather than being scattered through scoring code.

References:

- [WRC Rules](https://www.worldriichi.org/wrc-rules)
- [EMA Riichi Competition Rules](https://mahjong-europe.org/portal/index.php?Itemid=166&id=30&option=com_content&view=article)

### V1: guided winning-hand scanning

- Camera capture and gallery upload
- Guided framing overlay and capture-quality feedback
- Tile-face detection and perspective correction
- Classification of the 34 base tile types, red fives, tile backs, and unknown tiles
- Automatic ordering and grouping into concealed tiles, melds, winning tile, and indicators
- Confidence-aware correction interface
- Rule-aware validation of detection results
- Offline inference after the model has been installed
- Optional, consent-based submission of failed recognitions for model improvement

### V2: game sessions

- Track players, dealer, round, honba, riichi sticks, and current scores
- Carry visible and persistent context into every hand scan
- Automatically calculate score transfers and advance the round after confirmation
- Save a complete hand and result history
- Undo or correct the most recent result
- Share or export result cards and game summaries
- Optional center-console OCR for compatible automatic tables

### Later: whole-table assistant

- Detect discard grids, called tiles, and sideways riichi discards
- Infer seating positions and visible riichi sticks
- Analyze continuous video or periodic table snapshots
- Offer shanten, waits, and post-game analysis

Whole-table recognition should remain experimental until the guided scanner is reliable. Hands may be occluded, table layouts vary, and decisive events may no longer be visible when the photo is taken.

## Scoring engine design

The scoring engine must be a deterministic, platform-independent TypeScript package with no UI or vision dependencies.

### Canonical input

- Concealed tile multiset
- Winning tile
- Melds with type and open/closed state
- Dora and ura-dora indicators
- Round wind and seat wind
- Win method
- Riichi and situational flags
- Honba and riichi-stick count
- Active rules profile

### Processing stages

1. Validate tile counts, meld structure, and basic hand legality.
2. Enumerate every valid hand decomposition, including special hands.
3. Evaluate yaku and yakuman for each decomposition.
4. Calculate fu with an itemized explanation.
5. Count han, dora, red dora, and ura-dora.
6. Apply limits, rounding, dealer status, honba, and responsibility payments.
7. Choose the highest-value valid interpretation.
8. Return a structured explanation suitable for UI display and test snapshots.

### Correctness strategy

- Golden tests for every yaku and fu rule
- Boundary tests for mangan, haneman, baiman, sanbaiman, and yakuman
- Tests for ambiguous decompositions and wait shapes
- Tests for every supported rules-profile option
- Property tests for invariants such as tile conservation and payment totals
- A regression test for every scoring bug found in production
- Cross-check a large generated corpus against at least one independent reference implementation

## Vision system design

Use a two-stage pipeline so detection and classification can improve independently.

### Stage 1: tile detection

A lightweight detector locates tile faces and returns a bounding box or quadrilateral, orientation, and confidence. It should distinguish face-up tiles, tile backs, partially occluded tiles, and non-tile objects.

### Stage 2: tile classification

Each detected tile is perspective-corrected and normalized before classification. The classifier returns probabilities for all supported tile types, red fives, and an explicit unknown class.

### Geometry and structure

A deterministic geometry layer should:

- Sort tiles into visual order
- Group spatially separated tiles into hand, melds, and indicators
- Recognize sideways tiles in called melds
- Identify stacked or four-tile kan layouts
- Prefer a separated tile as the winning tile
- Ask the user to select the winning tile when geometry is ambiguous

### Rule-aware validation

Vision output should be checked before scoring. Useful checks include:

- No more than four physical copies of a base tile
- Expected concealed-hand size after accounting for melds and kans
- Legal chi sequences and pon/kan groups
- A winning tile that produces at least one complete hand
- Plausible indicator count

When validation fails, the correction screen should highlight the smallest set of questionable tiles instead of asking the user to review the entire hand.

### Training data

Combine:

- Synthetic scenes built from original or properly licensed tile artwork
- Real photographs from many physical tile sets and phones
- Multiple table colors, backgrounds, and lighting conditions
- Glare, shadows, blur, perspective, rotation, and partial occlusion augmentation
- Open melds, sideways tiles, stacked kans, and red fives
- Hard negatives such as sticks, dice, racks, fingers, and patterned tables

Corrections may become active-learning examples only with explicit user consent. Uploaded examples should be stripped of unnecessary metadata and retained under a documented privacy policy.

## Technical architecture

Use a TypeScript monorepo with a universal Expo client and platform-specific inference adapters.

```text
apps/
  client/              Expo + React Native Web application
packages/
  score-core/          Pure scoring and hand-validation engine
  rules/               Versioned ruleset profiles
  vision/              Preprocessing, inference contracts, and grouping
  ui/                  Shared camera, tile-picker, and result components
ml/
  datasets/            Dataset manifests and annotation utilities
  training/            Python training and evaluation pipelines
  export/              Quantization and ONNX export tools
```

### Client

- Expo and React Native Web for a shared Android, iOS, and browser experience
- Expo Camera for preview and capture across supported platforms
- A development build for native inference integrations
- Local-first state and history
- Accessible tile picker usable without camera permissions

[Expo Camera](https://docs.expo.dev/versions/latest/sdk/camera/) provides camera support for Android, iOS, and web.

### Model runtime

- Export models to ONNX
- Use `onnxruntime-web` with a WebAssembly fallback in browsers
- Use `onnxruntime-react-native` in native builds
- Keep preprocessing and postprocessing behavior identical across adapters
- Quantize models after establishing an accuracy baseline
- Bundle or securely cache versioned model artifacts

ONNX Runtime provides a shared JavaScript API across its web and React Native packages: [ONNX Runtime for JavaScript](https://onnxruntime.ai/docs/get-started/with-javascript/).

### Backend

Do not make a backend mandatory for calculation. Scoring and inference should run locally by default.

An optional backend can later provide:

- Account and cross-device synchronization
- Encrypted game-history backup
- Model version distribution
- Remote inference fallback on explicitly supported devices
- Consented failure-example collection
- Aggregate, privacy-preserving product metrics

## UX principles

- Ask for camera permission only when the user starts scanning.
- Explain how to arrange the tiles before the first scan.
- Give immediate feedback for blur, glare, cropping, or excessive perspective.
- Show recognized tiles as familiar tile faces, not class labels.
- Highlight only low-confidence detections.
- Make correction a single tap followed by a compact 34-tile picker.
- Never present a low-confidence score as certain.
- Preserve a fast manual path for unusual layouts and unsupported tile sets.
- Explain every yaku and fu component so users can audit the result.
- Keep advanced situational flags collapsed unless they may be relevant.

## Delivery roadmap

### Phase 0: product and rules specification — 1 week

- Select the first rules profile and document every option
- Finalize the hand, meld, context, and result schemas
- Define guided physical tile placement
- Establish scoring and recognition acceptance metrics
- Collect representative example photos before choosing a final model architecture

### Phase 1: scoring foundation — 1 to 2 weeks

- Implement validation and decomposition
- Implement yaku, fu, limits, and payments
- Add rules-profile support
- Build a broad golden-test corpus
- Expose a stable scoring API

### Phase 2: manual calculator — 1 to 2 weeks

- Build the optimized tile picker and meld editor
- Add context controls and rule selection
- Build the score explanation view
- Add local history
- Validate the UX on phone and desktop sizes

### Phase 3: vision proof of concept — 2 to 4 weeks

- Establish annotation format and dataset pipeline
- Train the first detector and classifier
- Build guided capture and preprocessing
- Export and run the models through ONNX on representative web and native devices
- Measure per-tile and exact-hand accuracy by tile set and capture condition

### Phase 4: scanner beta — 3 to 5 weeks

- Implement grouping and rule-aware validation
- Build the confidence-based correction workflow
- Improve poor-light, glare, rotation, and kan handling
- Package offline model delivery
- Run a closed beta across diverse physical tile sets

### Phase 5: session automation — 2 to 4 weeks

- Track players, rounds, dealer, honba, sticks, and scores
- Add score transfers, round advancement, and undo
- Add game history and result export
- Reduce context prompts using persistent session state

A focused application engineer and ML engineer should be able to reach a credible guided-scanner beta in approximately 8 to 12 weeks, assuming access to suitable training photographs.

## Release gates

### Scoring

- All supported golden scoring tests pass
- All rules-profile options have explicit tests
- No known discrepancies against the reference corpus
- Every result includes an auditable yaku, fu, and payment explanation

### Recognition

- At least 99.5% per-tile top-1 accuracy in guided capture conditions
- At least 93–95% exact full-hand recognition before correction
- Median tile corrections of zero
- Low-confidence and invalid structures always trigger review
- Performance reported separately for supported tile-set families

### Performance and reliability

- Median capture-to-result time below five seconds on supported mid-range devices
- Scoring and previously downloaded models work offline
- A scan can always fall back to manual correction without losing entered context
- Camera denial or unsupported inference produces a usable manual calculator

### Privacy and accessibility

- No photo upload without explicit consent
- Clear deletion controls for stored history and contributed examples
- Usable tile entry with screen readers and non-camera workflows
- Tile identity is not communicated by color alone

## Principal risks and mitigations

### Invisible game context

**Risk:** Some yaku and payment facts cannot be recovered from a hand photo.

**Mitigation:** Persist rules and round state in game sessions, then ask only for the remaining event-specific flags.

### Tile-set variation

**Risk:** Artwork, proportions, wear, and red-five designs vary widely.

**Mitigation:** Use a two-stage model, diverse real data, explicit supported-set metrics, an unknown class, and active learning from consented corrections.

### Ambiguous layout

**Risk:** The winning tile, meld boundaries, or kan structure may be unclear.

**Mitigation:** Provide a guided layout, use geometry plus rule validation, and request a focused correction when ambiguity remains.

### Scoring variants

**Risk:** Users may interpret a correct calculation under the wrong rules profile as a bug.

**Mitigation:** Version rules profiles, show the active profile on every result, and display relevant rule options in the explanation.

### Automation trust

**Risk:** One incorrect tile can silently produce a plausible but wrong score.

**Mitigation:** Calibrate confidence, validate hand structure, expose uncertain tiles, and never hide inference uncertainty.

## Recommended first implementation slice

The first end-to-end slice should support one rules profile and one carefully staged photo layout:

1. Enter or scan a closed standard hand.
2. Mark the winning tile.
3. Select ron or tsumo, seat wind, and round wind.
4. Calculate and explain yaku, fu, han, and payment.
5. Correct any recognized tile without restarting.

This slice proves the core scoring contract, camera workflow, inference boundary, and correction experience before expanding into open melds, kans, special hands, and game sessions.
