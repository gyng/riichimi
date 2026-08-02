# Roadmap

Last updated: **2026-08-02T00:00:00+08:00**

## Product objective

Deliver a polished mobile/web riichi companion that reaches an auditable result with the least safe amount of manual work. Automation may reduce effort, but it may not hide uncertainty, invent context, or make irreversible changes.

## Shipped foundation

- WRC 2025 scoring with validation, decomposition, yaku/yakuman, fu, limits, payments, and explanations.
- A web-only React 19 client on Vite, rendering real DOM elements styled by co-located CSS Modules over design tokens. No React Native, react-native-web, or Expo package remains — see [ADR 0004](docs/decisions/0004-web-only-dom-primitives.md).
- A responsive manual calculator and guided camera capture with private photo-reference fallback.
- Local table sessions with round context, riichi deposits, exhaustive-draw transfers, progression, history, persistence, erase confirmation, and undo.
- Recognition contracts and confidence-aware correction prioritization.
- Camera and gallery photo review with reference-preserving manual handoff and Android picker recovery.
- A versioned recognition artifact manifest gate covering integrity, provenance, classes, input, and release metrics.
- A rights-traceable guided recognition beta with deterministic 15-face localization, a bundled ONNX classifier, web/native adapters, confidence and physical-count review, and photograph-backed draft correction.
- A reproducible vision pipeline with pinned sources, crop partitions, augmentation, ONNX parity, artifact hashing, licensing, synthetic validation, and source-separated physical smoke evaluation.
- A tile-by-tile recognition review desk with visible confidence, top-three confirmation, a physically bounded full picker, atomic winner reassignment, and a hard gate against scoring unresolved reads.
- A V1 physical classifier promoted through source-separated comparison: 93.48% top-1 and 78.26% accepted coverage on 46 physical crops, with 100% accuracy among accepted reads and all errors retained for review.
- Deterministic pre-inference capture diagnostics with blur, glare, edge-crop, and excessive-perspective recovery guidance.
- Persistent WRC 2025 and explicit red-five-table profiles, with rules-aware tile entry, score attribution, legacy migration, and immutable per-table pinning.
- Typed WebMCP tools with visible, recoverable mutations.
- A deduplicated local score folio with audit details, removal, clear confirmation, and reload-safe direct links.
- Editable completed rounds over an event-sourced session log, with lossless v1→v2 migration, signed-score-change confirmation, and full undo — see [ADR 0004 (session log)](docs/decisions/0004-event-sourced-session-log.md).
- Named ruleset profiles with cited primary sources — WRC 2025, WRC red-five, Tenhou ranked, EMA 2016, JPML A, and M.League — plus a game-summary export.
- Four-language localization (English, 日本語, 简体中文, 繁體中文) covering visible copy and runtime-composed accessible names, guarded by an untranslated-string scanner.
- A win announcer behind a swappable speech port, with a stroke-by-stroke limit-hand celebration that honours `prefers-reduced-motion`.
- Unit, component, browser, coverage, formatting, lint, type, build, and screenshot checkpoints.

## P0 — production recognition and release confidence

1. **Representative recognition evidence** — the single blocker, and cross-validation now shows why
   - **Separate the corpus by tile design, not just by photograph.** Four of seven sources are one Wikimedia series: two in training, and the third is 37 of the 46 held-out crops. The 93.48% headline is measured on the design the model trained on. Held-out cross-validation puts the one genuinely unseen design at **30.3%** and out-of-fold accuracy at **75.7%**. Until the corpus has several distinct designs on both sides of the split, the release metric flatters the recognizer.
   - Grow the rights-cleared corpus beyond the current 107 training / 46 held-out physical crops to at least 500 complete guided hands spanning **tile designs**, phones, lighting, glare, perspective, red fives, and hard negatives — and count designs, not photographs, when judging whether it is representative.
   - **Add a third, source-separated validation partition.** Calibration currently cannot be fitted at all: the model is 100% accurate on the training split, and fitting on the evaluation split would be fitting to the test set.
   - **Include hard negatives** — sticks, dice, racks, fingers, patterned tables. Unknown recall is unmeasurable without them; the present corpus is all real tile faces.
   - Gate promotion on per-class accuracy, exact-hand accuracy, calibration, correction burden, and unknown-tile recall rather than the current smoke set.
   - Add immutable candidate manifests and safe model rollback after a candidate passes.
2. **Recognition review refinement**
   - Tune the shipped blur, glare, crop, and perspective diagnostics on representative phones and lighting conditions while retaining retry, cancel, and manual escape paths.
   - Measure correction burden and refine keyboard/screen-reader traversal on representative devices.
   - Expand from the deliberately narrow closed-hand guide to calls and kans only after each layout has independent evidence.
3. **Recognition robustness (safe-failure first)**
   - ~~Evaluation harness~~ — **done.** `scripts/vision/evaluate-recognizer.py` reports per-class and per-tile-set accuracy, ECE with reliability bins, correction burden per hand, false-unknown rate, a threshold sweep, and a 95% Wilson interval on every rate. `--baseline` states whether a change survives those intervals instead of implying it does.
   - ~~Test-time augmentation + confidence calibration~~ — **measured, not promoted.** TTA buys one crop of top-1 and costs one review per hand, which is a net loss for a review gate. Temperature scaling has no split to fit on. Neither separates from baseline. See the [model audit](docs/recognition-model-audit.md).
   - **Raise coverage without raising silent errors.** 3.26 reviews per scanned hand, with the model under-confident rather than over-confident and every error already one tap away in the top three — on the tile design it knows. Blocked on a validation split.
   - **Select the checkpoint on real photographs** — correctness, not accuracy. Training keeps the epoch that scored best on synthetic vector art (99.4%, saturated, wrong distribution). The per-fold oracle gap looks like 2.7–3.0 points, but real accuracy plateaus from epoch 5, so choosing one shared epoch by cross-validation is worth about two crops in 107 — inside the interval. Worth fixing because a selection rule should measure what it selects for; not worth expecting a gain from.
   - ~~Leave-one-source-out cross-validation~~ — **done.** `scripts/vision/cross-validate.py` trains on two photographed sets and validates on the third, giving out-of-fold predictions for all 107 real crops without spending any of the held-out 46.
   - A learned localizer (to handle touching tiles and textured tables — the biggest practical brittleness) is gated on boxed real data; the synthetic hand renderer already scaffolds per-tile boxes for it.
4. **Device QA**
   - Verify camera, storage recovery, rotation, large text, keyboard, screen readers, reduced motion, and offline restart on representative devices. Riichimi is browser-only, so this is mobile Safari and Chrome on real hardware.
   - Benchmark model initialization, preprocessing, inference, memory, thermals, and interaction responsiveness on mid-range phones.

Exit gate: representative guided scans meet documented accuracy and latency targets on mid-range hardware, the full journey passes on all targets, and failures degrade cleanly to manual entry.

## P1 — rules and session completeness

- Keep extending the scoring cross-check as rules grow. The payment table, closed/open/ambiguous worked hands, and each shipped profile are covered; every discrepancy stays as a regression test.
- **Result-card sharing** built on the game-summary export.
- **Mahjong Soul (Jantama).** Deliberately not shipped with the other profiles. Two of its options are not stated on its official page, and it is the one ruleset paying single-yaku double yakuman. The engine now scores that case, so what remains is a sourcing problem, not an engine one: adopt the profile when the missing options have a citable primary source.
- **Domain-vocabulary localization.** Yaku names and fu-audit reasons still render in English in every locale, because they originate in `score-core` where an i18n import would reverse the dependency direction. The fix is an interface-layer dictionary keyed by stable yaku id; fu reasons are composed English and need structuring first. This is a feature, not a wrapping pass.
- Expand WebMCP only for proven high-value tasks; preserve visible effects, schema validation, and human control.

## P1 — experience and audio

- ~~Local neural voice~~ — **done.** Kokoro 82M sits behind the same speech port as the browser voice, chosen from Setup, off by default. It costs 5 KB in the shared entry and nothing in the install tree: the engine is fetched from a CDN when selected rather than bundled, because bundling it means a 21.6 MB WASM binary in every deploy and `sharp`'s unfixed libvips advisories in the tree.
- **A neural voice that speaks Japanese.** The shipped one reads romaji and English in an American voice. Kokoro has Japanese voices; the announcement text would need to be composed per locale rather than transliterated, which is the same id-keyed dictionary problem as the yaku names above.
- **Device-width re-audit.** The layouts are authored mobile-first with media queries rather than measured widths, but they have not been re-audited against real device widths, large text, and landscape since the CSS conversion.

## P2 — operational polish

- Add CI matrices for quality, static build, and browser dogfood.
- Add signed build/release provenance, dependency review, and privacy copy.
- Measure startup, memory, model initialization, inference, and bundle growth; run targeted optimization only when a documented budget is crossed.
- Add consented, metadata-stripped recognition feedback only after retention and deletion policy is approved.

## Later experiments

- Center-console OCR, whole-table snapshots, discard recognition, and continuous-video assistance.
- Shanten, waits, and post-game analysis.

These remain experiments until the guided winning-hand scanner is reliable; they must not delay or destabilize the core scoring flow.
