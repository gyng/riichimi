import { canonicalTileIds, canonicalizeTile } from "./tile";
import type { CanonicalTileId, TileId } from "./tile";

export interface TileInventoryIssue {
  readonly actual: number;
  readonly code: "TOO_MANY_COPIES";
  readonly maximum: 4;
  readonly tile: CanonicalTileId;
}

export interface TileInventoryAudit {
  readonly counts: Readonly<Partial<Record<CanonicalTileId, number>>>;
  readonly issues: readonly TileInventoryIssue[];
}

export function auditTileInventory(tiles: readonly TileId[]): TileInventoryAudit {
  const counts: Partial<Record<CanonicalTileId, number>> = {};

  for (const tile of tiles) {
    const canonicalTile = canonicalizeTile(tile);
    counts[canonicalTile] = (counts[canonicalTile] ?? 0) + 1;
  }

  const issues: TileInventoryIssue[] = [];

  for (const tile of canonicalTileIds) {
    const actual = counts[tile] ?? 0;

    if (actual > 4) {
      issues.push({ actual, code: "TOO_MANY_COPIES", maximum: 4, tile });
    }
  }

  return { counts, issues };
}
