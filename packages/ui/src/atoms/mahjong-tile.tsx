import type { TileId } from "@riichimi/score-core";

import { classNames } from "../class-names";
import { tileArt } from "./tile-art";
import { useTileDisplay } from "./tile-display-context";
import styles from "./mahjong-tile.module.css";

const honourGlyphs = {
  east: "東",
  green: "發",
  north: "北",
  red: "中",
  south: "南",
  west: "西",
  white: "白",
} as const;

const honourNames = {
  east: "East wind",
  green: "Green dragon",
  north: "North wind",
  red: "Red dragon",
  south: "South wind",
  west: "West wind",
  white: "White dragon",
} as const;

type HonourTile = keyof typeof honourGlyphs;

function isHonourTile(tile: TileId): tile is HonourTile {
  return (
    tile === "east" ||
    tile === "south" ||
    tile === "west" ||
    tile === "north" ||
    tile === "white" ||
    tile === "green" ||
    tile === "red"
  );
}

export function tileAccessibleName(tile: TileId): string {
  if (isHonourTile(tile)) {
    return honourNames[tile];
  }

  const rank = tile[0] === "0" ? "red five" : tile[0];
  const suit = tile.endsWith("m") ? "characters" : tile.endsWith("p") ? "circles" : "bamboo";
  return `${rank} ${suit}`;
}

export interface MahjongTileProps {
  readonly disabled?: boolean;
  /** Fill the parent's width instead of sitting at the fixed tile size, so a
      picker can fit a whole suit on one row at any screen width. */
  readonly fill?: boolean;
  readonly onPress?: () => void;
  readonly selected?: boolean;
  readonly tile: TileId;
}

/** The rank shorthand shown in the corner when a player asks for it. */
function cornerLabel(tile: TileId): string | null {
  if (isHonourTile(tile)) {
    return null;
  }
  const suit = tile.endsWith("m") ? "m" : tile.endsWith("p") ? "p" : "s";
  return `${tile[0] === "0" ? "5" : tile[0]}${suit}`;
}

export function MahjongTile({
  disabled = false,
  fill = false,
  onPress,
  selected = false,
  tile,
}: MahjongTileProps) {
  const { showRankLabels } = useTileDisplay();
  const Art = tileArt[tile];
  const corner = showRankLabels ? cornerLabel(tile) : null;
  const className = classNames(
    styles["tile"],
    fill && styles["fill"],
    selected && styles["selected"],
  );
  const content = (
    <>
      <Art height="100%" preserveAspectRatio="xMidYMid meet" width="100%" />
      {corner === null ? null : (
        <span aria-hidden className={styles["corner"]}>
          {corner}
        </span>
      )}
    </>
  );

  // A tile nobody can press is a picture of a tile, not a control.
  if (onPress === undefined) {
    return (
      <div aria-label={tileAccessibleName(tile)} className={className} role="img">
        {content}
      </div>
    );
  }

  return (
    <button
      aria-label={tileAccessibleName(tile)}
      aria-pressed={selected}
      className={className}
      disabled={disabled}
      onClick={onPress}
      type="button"
    >
      {content}
    </button>
  );
}
