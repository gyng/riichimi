// The "natural" capture layout — everything on ONE row, left-to-right, the way a
// revealed hand actually reads (melds to the right, no stacked rows):
//
//   concealed hand (touching, winning tile nudged after a moderate gap) ·
//   each called meld/kan group (set well apart) ·
//   one dora indicator after the final gap.
//
// This is the counterpart to the row-based `locateGuidedTiles`, selectable as a
// capture mode. It is more natural to stage but structurally ambiguous: a single
// row has to carry three gap meanings at once — within-group (tight), the
// winning-tile nudge (moderate), and structural boundaries between the hand, each
// meld, and the dora (wide). When a user's winner nudge grows to structural
// width, or a meld sits too close to the hand, the parse mis-structures the hand
// (open vs closed changes han and fu). Because this guess is not reliable, the
// natural mode requires an explicit structure confirmation at the review gate
// (see `recognition-review-panel.tsx`); `single-row-layout.test.ts` documents
// both the happy path and the two mis-structure modes the review step exists to
// catch.

import { candidateComponents, clusterRows, median, normalized, widthOf } from "./guided-layout";
import type { Component, GuidedLayoutResult, PixelFrame } from "./guided-layout";

// A gap wider than this many tile-widths is read as a structural boundary (hand →
// meld → meld → dora). The winning-tile nudge must stay below it; this is exactly
// the tier separation the convention depends on.
const structuralGapRatio = 1;

function segmentByGaps(line: readonly Component[], boundary: number): Component[][] {
  const segments: Component[][] = [];
  let current: Component[] = [];
  for (let index = 0; index < line.length; index += 1) {
    const component = line[index];
    if (component === undefined) {
      continue;
    }
    const previous = line[index - 1];
    if (previous !== undefined && component.left - previous.right > boundary) {
      segments.push(current);
      current = [];
    }
    current.push(component);
  }
  if (current.length > 0) {
    segments.push(current);
  }
  return segments;
}

export function locateSingleRowTiles(frame: PixelFrame): GuidedLayoutResult {
  if (
    frame.width <= 0 ||
    frame.height <= 0 ||
    frame.data.length !== frame.width * frame.height * 4
  ) {
    throw new RangeError("Pixel frame dimensions must match its RGBA data.");
  }
  const components = candidateComponents(frame);
  const failure = (message: string): GuidedLayoutResult => ({
    foundTileFaces: components.length,
    kind: "failure",
    message,
  });

  // Single-row staging: everything should land on one horizontal line. Reject a
  // stray second row rather than guessing which line is the hand.
  const rows = clusterRows(components);
  const line = rows.toSorted((left, right) => right.length - left.length)[0];
  if (line === undefined || line.length < 3) {
    return failure(
      `Found ${components.length} tile-like faces. Lay the whole hand on one row: concealed tiles, then any melds, then the dora on the right.`,
    );
  }
  const strays = rows.filter((row) => row !== line).reduce((sum, row) => sum + row.length, 0);
  if (strays > 0) {
    return failure(
      `Keep every tile on one row for this layout; ${strays} tile(s) sat on another line.`,
    );
  }

  const sorted = line.toSorted((left, right) => left.left - right.left);
  const boundary = median(sorted.map(widthOf)) * structuralGapRatio;
  const segments = segmentByGaps(sorted, boundary);

  // The dora is the single tile after the final structural gap.
  const doraSegment = segments.at(-1);
  const doraComponent = doraSegment?.[0];
  if (doraSegment === undefined || doraSegment.length !== 1 || doraComponent === undefined) {
    return failure(
      `End the row with exactly one separated dora indicator; the rightmost group had ${doraSegment?.length ?? 0} tiles.`,
    );
  }

  // Melds sit just left of the dora, each a group of 3 (chi/pon) or 4 (kan). Pull
  // them off the right; whatever remains to the left is the concealed hand. This
  // is the fragile step: a hand fragment of size 3–4 is indistinguishable from a
  // meld here, and a meld merged into the hand simply disappears.
  const body = segments.slice(0, -1);
  const melds: Component[][] = [];
  while (body.length > 1) {
    const candidate = body.at(-1);
    if (candidate === undefined || (candidate.length !== 3 && candidate.length !== 4)) {
      break;
    }
    melds.unshift(candidate);
    body.pop();
  }
  const concealed = body.flat().toSorted((left, right) => left.left - right.left);
  if (concealed.length < 2) {
    return failure("The concealed hand needs at least two tiles before the melds and dora.");
  }

  const totalTiles = concealed.length + melds.reduce((sum, meld) => sum + meld.length, 0);
  if (totalTiles < 14 || totalTiles > 18) {
    return failure(
      `A winning hand is 14–18 tiles (with kans); found ${totalTiles} across the hand and melds.`,
    );
  }

  // Winning tile: the largest gap inside the concealed run, scoped to that segment
  // — the same convention the shipping parser uses.
  const gaps = concealed
    .slice(1)
    .map((component, index) => component.left - (concealed[index]?.right ?? 0));
  const medianGap = median(gaps);
  const maximumGap = gaps.length > 0 ? Math.max(...gaps) : 0;
  const winningIndex = gaps.indexOf(maximumGap) + 1;
  const winningRoleCertain =
    gaps.length > 0 && maximumGap >= Math.max(frame.width * 0.012, medianGap * 1.7);

  return {
    concealed: concealed.map((component) => normalized(component, frame)),
    dora: normalized(doraComponent, frame),
    kind: "success",
    melds: melds.map((meld) => meld.map((component) => normalized(component, frame))),
    winningIndex: winningRoleCertain ? winningIndex : concealed.length - 1,
    winningRoleCertain,
  };
}
