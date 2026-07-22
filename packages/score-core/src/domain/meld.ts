import type { CanonicalTileId, TileId } from "./tile";

export type DeclaredMeld =
  | {
      readonly kind: "sequence";
      readonly open: true;
      readonly tiles: readonly [TileId, TileId, TileId];
    }
  | {
      readonly kind: "triplet";
      readonly open: true;
      readonly tile: TileId;
    }
  | {
      readonly kind: "quad";
      readonly open: boolean;
      readonly tile: TileId;
    };

export type StandardGroup =
  | {
      readonly kind: "sequence";
      readonly open: boolean;
      readonly tiles: readonly [CanonicalTileId, CanonicalTileId, CanonicalTileId];
    }
  | {
      readonly kind: "triplet" | "quad";
      readonly open: boolean;
      readonly tile: CanonicalTileId;
    };

export function groupTiles(group: StandardGroup): readonly CanonicalTileId[] {
  if (group.kind === "sequence") {
    return group.tiles;
  }

  const count = group.kind === "quad" ? 4 : 3;
  return Array.from({ length: count }, () => group.tile);
}
