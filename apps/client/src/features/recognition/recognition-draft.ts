import {
  canonicalizeTile,
  canonicalTileIds,
  redFiveIds,
  tileRank,
  tileSuit,
} from "@richii/score-core";
import type { DeclaredMeld, TileId } from "@richii/score-core";

export interface RecognitionDraft {
  readonly concealedTiles: readonly TileId[];
  readonly doraIndicators: readonly [TileId];
  readonly melds: readonly DeclaredMeld[];
  readonly modelVersion: string;
  readonly reviewedCount: number;
  readonly winningIndex: number;
}

const tileIds = new Set<string>([...canonicalTileIds, ...redFiveIds]);

function isTile(value: string): value is TileId {
  return tileIds.has(value);
}

// Infer a called meld's structure from its classified tiles. Melds default to
// open; open-vs-closed (e.g. ankan) and called-from are confirmed in review, not
// inferred from a photo. Returns null when the tiles do not form a legal meld, so
// a misread group is rejected rather than silently mis-scored.
export function inferMeld(rawTiles: readonly string[]): DeclaredMeld | null {
  if (rawTiles.length < 3 || rawTiles.length > 4 || !rawTiles.every(isTile)) {
    return null;
  }
  const tiles: readonly TileId[] = rawTiles;
  const canonical = tiles.map(canonicalizeTile);
  const first = canonical[0];
  const allIdentical = first !== undefined && canonical.every((tile) => tile === first);

  if (tiles.length === 4) {
    return allIdentical ? { kind: "quad", open: true, tile: first } : null;
  }
  if (allIdentical) {
    return { kind: "triplet", open: true, tile: first };
  }
  // A sequence: one suit, three consecutive ranks. Rank/suit are read from the
  // canonical tile (red fives normalise to 5) while the meld keeps the original
  // ids, since a chi may legitimately contain the red five.
  const ranked = tiles.map((tile) => {
    const canon = canonicalizeTile(tile);
    return { rank: tileRank(canon), suit: tileSuit(canon), tile };
  });
  const suit = ranked[0]?.suit ?? null;
  if (suit === null || ranked.some((entry) => entry.suit !== suit || entry.rank === null)) {
    return null;
  }
  const ordered = ranked.toSorted((left, right) => (left.rank ?? 0) - (right.rank ?? 0));
  const [low, middle, high] = ordered;
  if (
    low === undefined ||
    middle === undefined ||
    high === undefined ||
    low.rank === null ||
    middle.rank === null ||
    high.rank === null ||
    middle.rank !== low.rank + 1 ||
    high.rank !== low.rank + 2
  ) {
    return null;
  }
  return { kind: "sequence", open: true, tiles: [low.tile, middle.tile, high.tile] };
}

// Melds serialize as groups separated by "|", tiles within a group by ",".
export function serializeRecognizedMelds(groups: readonly (readonly TileId[])[]): string {
  return groups.map((group) => group.join(",")).join("|");
}

function parseMelds(encoded: string): readonly DeclaredMeld[] | undefined {
  if (encoded.length === 0) {
    return [];
  }
  const melds: DeclaredMeld[] = [];
  for (const group of encoded.split("|")) {
    const meld = inferMeld(group.split(","));
    if (meld === null) {
      return undefined;
    }
    melds.push(meld);
  }
  return melds;
}

export function parseRecognitionDraft(input: {
  readonly dora?: string | undefined;
  readonly melds?: string | undefined;
  readonly modelVersion?: string | undefined;
  readonly reviewedCount?: string | undefined;
  readonly tiles?: string | undefined;
  readonly winningIndex?: string | undefined;
}): RecognitionDraft | undefined {
  const tiles = input.tiles?.split(",") ?? [];
  const dora = input.dora;
  const winningIndex = Number(input.winningIndex);
  const reviewedCount = Number(input.reviewedCount);
  const melds = parseMelds(input.melds ?? "");
  if (melds === undefined) {
    return undefined;
  }
  // A winning hand has (14 - 3 per called meld) concealed tiles; a kan still
  // occupies one set slot and its extra tile is implied by kind: "quad".
  const expectedConcealed = 14 - melds.length * 3;
  if (
    expectedConcealed < 2 ||
    tiles.length !== expectedConcealed ||
    !tiles.every(isTile) ||
    dora === undefined ||
    !isTile(dora) ||
    !Number.isInteger(winningIndex) ||
    winningIndex < 0 ||
    winningIndex >= expectedConcealed ||
    !Number.isInteger(reviewedCount) ||
    reviewedCount < 0 ||
    input.modelVersion === undefined ||
    input.modelVersion.trim().length === 0
  ) {
    return undefined;
  }
  return {
    concealedTiles: tiles,
    doraIndicators: [dora],
    melds,
    modelVersion: input.modelVersion,
    reviewedCount,
    winningIndex,
  };
}
