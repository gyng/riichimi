import type { TileId } from "@riichimi/score-core";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { color, radius } from "../tokens/theme";
import { tileArt } from "./tile-art";
import { useTileDisplay } from "./tile-display-context";

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
  const content = (
    <>
      <Art height="100%" preserveAspectRatio="xMidYMid meet" width="100%" />
      {corner === null ? null : (
        <View accessibilityElementsHidden style={styles.corner}>
          <Text style={styles.cornerLabel}>{corner}</Text>
        </View>
      )}
    </>
  );

  if (onPress === undefined) {
    return (
      <View
        accessibilityLabel={tileAccessibleName(tile)}
        style={[styles.tile, fill && styles.fill, selected && styles.selected]}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={tileAccessibleName(tile)}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        fill && styles.fill,
        selected && styles.selected,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  corner: {
    backgroundColor: "rgba(255,253,247,0.9)",
    borderRadius: 3,
    paddingHorizontal: 2,
    position: "absolute",
    right: 2,
    top: 2,
  },
  cornerLabel: { color: color.ink, fontFamily: "monospace", fontSize: 8, fontWeight: "800" },
  disabled: {
    opacity: 0.28,
  },
  pressed: {
    transform: [{ translateY: 2 }],
  },
  selected: {
    borderColor: color.accent,
    borderWidth: 3,
  },
  fill: { minHeight: 0, minWidth: 0, width: "100%" },
  // A tile is the one deliberate exception to the 48x48 target minimum: a suit
  // row shows all nine ranks, which cannot each be 48 wide on a narrow phone
  // without wrapping mid-suit and breaking the row people scan. Height stays
  // comfortably above the minimum and tiles keep a real gap between them.
  tile: {
    alignItems: "center",
    aspectRatio: 0.75,
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderRadius: radius.tile,
    borderWidth: 2,
    overflow: "hidden",
    justifyContent: "center",
    minHeight: 52,
    minWidth: 38,
    shadowColor: color.ink,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 0,
  },
});
