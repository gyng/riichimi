# Design: Guided meld/kan capture for the camera recognizer

Status: **plan + phase 1 in progress.** Expands the guided recognizer from a
closed-hand-only guide to one that also captures called melds (chi/pon) and kans,
while keeping the deliberately-narrow, review-gated philosophy.

## Honest scope boundary

What is **tractable now** (deterministic geometry + the existing classifier):

- Spatially separating the concealed hand from called meld groups, and grouping
  meld tiles into sets of 3 (chi/pon) or 4 (kan).
- Classifying every tile (already works; 34 tiles + 3 red fives + unknown).
- Inferring meld **type** from the classified tiles: a 3-group of consecutive
  tiles → chi (sequence); a 3-group of identical tiles → pon (triplet); a
  4-group → kan.

What stays **user-confirmed, not auto-detected** (genuinely data-gated — needs a
much richer localizer and real training data for rotation/face-down cues):

- **open vs closed** kan (ankan shows two face-down tiles; the classifier has no
  "tile back" class today),
- **called-from-player** (a called tile is rotated 90° to show the discarder),
- These default sensibly (melds default to open, kan defaults to open) and the
  review desk lets the user set them, consistent with the "make uncertainty
  visible and correctable" principle. The scoring engine already handles open vs
  closed melds and kans fully, so once the structure is confirmed the score is
  correct.

## Layout convention (deterministic to parse)

Rather than fragile within-row gap thresholds (which the current winning-tile gap
already consumes), use **row separation** — which the localizer already does by
clustering components by vertical centre:

1. **Top row** — the concealed hand tiles, touching or lightly spaced, with one
   larger gap marking the winning tile (the existing convention).
2. **Middle row** (optional) — the called melds, each group of 3–4 tiles set
   apart from the next by a clear gap; absent for a fully concealed hand.
3. **Bottom row** — the one dora indicator.

A fully concealed hand has no middle row and parses exactly as today.

## Phases

### Phase 1 — localizer (this change)

`apps/client/src/features/recognition/guided-layout.ts`:

- Cluster components into rows (existing). Classify rows by vertical position and
  tile count: the concealed row (top, most tiles), an optional meld row (middle),
  and the dora row (bottom, exactly 1).
- Within the meld row, split into groups by gaps (large gap = group boundary);
  each group must be 3 or 4 tiles.
- Winning tile: the largest-gap tile within the **concealed** row (existing
  logic, scoped to that row).
- New result shape:
  ```ts
  type GuidedLayoutResult =
    | {
        kind: "success";
        concealed: readonly NormalizedBounds[];
        melds: readonly (readonly NormalizedBounds[])[]; // each length 3 or 4
        dora: NormalizedBounds;
        winningIndex: number; // index within concealed
        winningRoleCertain: boolean;
      }
    | { kind: "failure"; foundTileFaces: number; message: string };
  ```
  A closed hand returns `melds: []` and `concealed` of the full hand — the
  previous behaviour, re-expressed. Validation: concealed ≥ 2, each meld 3–4,
  total physical tiles in a sane range (≈14–18); downstream scoring does the real
  legality check.
- Tests: closed hand still parses; one open triplet meld; one kan (4-group); a
  chi meld; rejection of a malformed meld group (size 2 or 5); the dora still
  required below.

### Phase 2 — recognition pipeline

`recognize-pixel-frame.ts`: crop and classify concealed + meld + dora tiles;
assign `role: "meld"` to meld-group tiles (the `DetectionRole` union already has
it), carrying a group index so the review/draft can reassemble sets.

### Phase 3 — structure inference + draft

Infer each meld's type from its classified tiles (sequence → chi, identical → pon,
4 → kan). Extend `RecognitionDraft` with `melds: readonly DeclaredMeld[]` (default
open; kan open), and wire the draft → the manual calculator's meld inputs. The
calculator + scoring already consume `DeclaredMeld[]`.

### Phase 4 — review desk

Show meld groups distinctly; let the user set open/closed (and, later,
called-from), correct tiles, and re-type a meld. Keep the hard gate: no scoring
until every meld's structure is confirmed. Extend the capture guide illustration.

## Risks / decisions

- Meld **type** inference trusts the classifier; a misread tile could turn a chi
  into a pon. Mitigation: the review desk shows the group and its inferred type
  for confirmation before scoring (same trust model as the concealed hand today).
- Open/closed and called-from are **not** inferred — explicitly a manual step, so
  the recognizer never silently assumes hand openness (which changes han and fu).
- This is still a **review-gated beta**; accuracy claims remain gated on the P0
  representative corpus, now including meld layouts.
