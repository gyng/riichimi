import { enumerateStandardDecompositions } from "../domain/decomposition";
import type { StandardDecomposition } from "../domain/decomposition";
import type { StandardGroup } from "../domain/meld";
import { canonicalTileIds, isTerminalOrHonor, tileRank } from "../domain/tile";
import type { CanonicalTileId } from "../domain/tile";
import type { NormalizedHand } from "./normalize-hand";

export type WaitType = "kanchan" | "penchan" | "ryanmen" | "shanpon" | "tanki";

export interface WinningPlacement {
  readonly concealedGroupIndex: number | null;
  readonly wait: WaitType;
}

export interface StandardInterpretation {
  readonly decomposition: StandardDecomposition;
  readonly groups: readonly StandardGroup[];
  readonly placement: WinningPlacement;
}

function countsOf(tiles: readonly CanonicalTileId[]): Partial<Record<CanonicalTileId, number>> {
  const counts: Partial<Record<CanonicalTileId, number>> = {};

  for (const tile of tiles) {
    counts[tile] = (counts[tile] ?? 0) + 1;
  }

  return counts;
}

export function isSevenPairs(hand: NormalizedHand): boolean {
  if (!hand.isClosed || hand.melds.length > 0 || hand.concealedTiles.length !== 14) {
    return false;
  }

  const counts = countsOf(hand.concealedTiles);
  return canonicalTileIds.filter((tile) => counts[tile] === 2).length === 7;
}

const orphanTiles = canonicalTileIds.filter(isTerminalOrHonor);

export function isThirteenOrphans(hand: NormalizedHand): boolean {
  if (!hand.isClosed || hand.melds.length > 0 || hand.concealedTiles.length !== 14) {
    return false;
  }

  const counts = countsOf(hand.concealedTiles);
  return orphanTiles.every((tile) => (counts[tile] ?? 0) >= 1);
}

function waitForSequence(
  group: Extract<StandardGroup, { readonly kind: "sequence" }>,
  winningTile: CanonicalTileId,
): WaitType | null {
  const winningIndex = group.tiles.indexOf(winningTile);
  const startRank = tileRank(group.tiles[0]);

  if (winningIndex < 0 || startRank === null) {
    return null;
  }

  if (winningIndex === 1) {
    return "kanchan";
  }

  if ((startRank === 1 && winningIndex === 2) || (startRank === 7 && winningIndex === 0)) {
    return "penchan";
  }

  return "ryanmen";
}

function placementsFor(
  decomposition: StandardDecomposition,
  winningTile: CanonicalTileId,
): readonly WinningPlacement[] {
  const placements: WinningPlacement[] = [];

  if (decomposition.pair === winningTile) {
    placements.push({ concealedGroupIndex: null, wait: "tanki" });
  }

  decomposition.concealedGroups.forEach((group, concealedGroupIndex) => {
    if (group.kind === "sequence") {
      const wait = waitForSequence(group, winningTile);

      if (wait !== null) {
        placements.push({ concealedGroupIndex, wait });
      }
    } else if (group.tile === winningTile) {
      placements.push({ concealedGroupIndex, wait: "shanpon" });
    }
  });

  return placements;
}

export function enumerateStandardInterpretations(
  hand: NormalizedHand,
): readonly StandardInterpretation[] {
  return enumerateStandardDecompositions(hand.concealedTiles, hand.melds.length).flatMap(
    (decomposition) =>
      placementsFor(decomposition, hand.winningTile).map((placement) => ({
        decomposition,
        groups: [...hand.melds, ...decomposition.concealedGroups],
        placement,
      })),
  );
}
