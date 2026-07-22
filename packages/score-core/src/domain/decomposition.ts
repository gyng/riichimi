import type { StandardGroup } from "./meld";
import { canonicalTileIds, suitedTile, tileRank, tileSuit } from "./tile";
import type { CanonicalTileId } from "./tile";

export interface StandardDecomposition {
  readonly concealedGroups: readonly StandardGroup[];
  readonly pair: CanonicalTileId;
}

type TileCounts = Partial<Record<CanonicalTileId, number>>;

function nextSuitedTile(tile: CanonicalTileId, offset: 1 | 2): CanonicalTileId | null {
  const rank = tileRank(tile);
  const suit = tileSuit(tile);

  if (rank === null || suit === null || rank + offset > 9) {
    return null;
  }

  return suitedTile(rank + offset, suit);
}

function firstRemainingTile(counts: TileCounts): CanonicalTileId | null {
  return canonicalTileIds.find((tile) => (counts[tile] ?? 0) > 0) ?? null;
}

function removeTiles(counts: TileCounts, tiles: readonly CanonicalTileId[]): TileCounts {
  const next = { ...counts };

  for (const tile of tiles) {
    next[tile] = (next[tile] ?? 0) - 1;
  }

  return next;
}

function enumerateGroups(
  counts: TileCounts,
  groupsNeeded: number,
  groups: readonly StandardGroup[] = [],
): readonly (readonly StandardGroup[])[] {
  const first = firstRemainingTile(counts);

  if (first === null) {
    return groups.length === groupsNeeded ? [groups] : [];
  }

  if (groups.length >= groupsNeeded) {
    return [];
  }

  const results: (readonly StandardGroup[])[] = [];

  if ((counts[first] ?? 0) >= 3) {
    results.push(
      ...enumerateGroups(removeTiles(counts, [first, first, first]), groupsNeeded, [
        ...groups,
        { kind: "triplet", open: false, tile: first },
      ]),
    );
  }

  const second = nextSuitedTile(first, 1);
  const third = nextSuitedTile(first, 2);

  if (second !== null && third !== null && (counts[second] ?? 0) > 0 && (counts[third] ?? 0) > 0) {
    results.push(
      ...enumerateGroups(removeTiles(counts, [first, second, third]), groupsNeeded, [
        ...groups,
        { kind: "sequence", open: false, tiles: [first, second, third] },
      ]),
    );
  }

  return results;
}

export function enumerateStandardDecompositions(
  tiles: readonly CanonicalTileId[],
  declaredMeldCount: number,
): readonly StandardDecomposition[] {
  const groupsNeeded = 4 - declaredMeldCount;

  if (groupsNeeded < 0 || tiles.length !== groupsNeeded * 3 + 2) {
    return [];
  }

  const counts: TileCounts = {};

  for (const tile of tiles) {
    counts[tile] = (counts[tile] ?? 0) + 1;
  }

  const results: StandardDecomposition[] = [];

  for (const pair of canonicalTileIds) {
    if ((counts[pair] ?? 0) < 2) {
      continue;
    }

    const withoutPair = removeTiles(counts, [pair, pair]);

    for (const concealedGroups of enumerateGroups(withoutPair, groupsNeeded)) {
      results.push({ concealedGroups, pair });
    }
  }

  return results;
}
