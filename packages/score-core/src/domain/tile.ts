export const canonicalTileIds = [
  "1m",
  "2m",
  "3m",
  "4m",
  "5m",
  "6m",
  "7m",
  "8m",
  "9m",
  "1p",
  "2p",
  "3p",
  "4p",
  "5p",
  "6p",
  "7p",
  "8p",
  "9p",
  "1s",
  "2s",
  "3s",
  "4s",
  "5s",
  "6s",
  "7s",
  "8s",
  "9s",
  "east",
  "south",
  "west",
  "north",
  "white",
  "green",
  "red",
] as const;

export const redFiveIds = ["0m", "0p", "0s"] as const;

export type CanonicalTileId = (typeof canonicalTileIds)[number];
export type RedFiveId = (typeof redFiveIds)[number];
export type TileId = CanonicalTileId | RedFiveId;
export type Suit = "m" | "p" | "s";
export type Wind = "east" | "south" | "west" | "north";
export type Dragon = "white" | "green" | "red";
export type HonorTileId = Wind | Dragon;

const redFiveToCanonical = {
  "0m": "5m",
  "0p": "5p",
  "0s": "5s",
} as const satisfies Record<RedFiveId, CanonicalTileId>;

export function isRedFive(tile: TileId): tile is RedFiveId {
  return tile === "0m" || tile === "0p" || tile === "0s";
}

export function canonicalizeTile(tile: TileId): CanonicalTileId {
  return isRedFive(tile) ? redFiveToCanonical[tile] : tile;
}

export function tileSuit(tile: CanonicalTileId): Suit | null {
  if (tile.endsWith("m")) {
    return "m";
  }

  if (tile.endsWith("p")) {
    return "p";
  }

  if (tile.endsWith("s")) {
    return "s";
  }

  return null;
}

export function tileRank(tile: CanonicalTileId): number | null {
  return tileSuit(tile) === null ? null : Number(tile[0]);
}

export function isHonor(tile: CanonicalTileId): tile is HonorTileId {
  return tileSuit(tile) === null;
}

export function isDragon(tile: CanonicalTileId): tile is Dragon {
  return tile === "white" || tile === "green" || tile === "red";
}

export function isWind(tile: CanonicalTileId): tile is Wind {
  return tile === "east" || tile === "south" || tile === "west" || tile === "north";
}

export function isTerminal(tile: CanonicalTileId): boolean {
  const rank = tileRank(tile);
  return rank === 1 || rank === 9;
}

export function isTerminalOrHonor(tile: CanonicalTileId): boolean {
  return isHonor(tile) || isTerminal(tile);
}

export function isInside(tile: CanonicalTileId): boolean {
  const rank = tileRank(tile);
  return rank !== null && rank >= 2 && rank <= 8;
}

export function suitedTile(rank: number, suit: Suit): CanonicalTileId | null {
  if (!Number.isInteger(rank) || rank < 1 || rank > 9) {
    return null;
  }

  const id = `${rank}${suit}`;
  return canonicalTileIds.find((tile) => tile === id) ?? null;
}
