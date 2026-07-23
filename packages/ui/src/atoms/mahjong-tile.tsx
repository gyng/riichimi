import type { TileId } from "@riichimi/score-core";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { color, radius } from "../tokens/theme";

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
  readonly onPress?: () => void;
  readonly selected?: boolean;
  readonly tile: TileId;
}

export function MahjongTile({
  disabled = false,
  onPress,
  selected = false,
  tile,
}: MahjongTileProps) {
  const isHonour = isHonourTile(tile);
  const isRedFive = tile.startsWith("0");
  const suitGlyph = tile.endsWith("m") ? "萬" : tile.endsWith("p") ? "筒" : "索";
  const suitColor = tile.endsWith("p") ? color.jade : tile.endsWith("s") ? "#2D7045" : color.accent;
  const content = isHonour ? (
    <Text style={[styles.honour, tile === "red" && styles.redHonour]}>{honourGlyphs[tile]}</Text>
  ) : (
    <View style={styles.suited}>
      <Text style={[styles.rank, { color: isRedFive ? color.accent : color.ink }]}>
        {isRedFive ? "5" : tile[0]}
      </Text>
      <Text style={[styles.suit, { color: suitColor }]}>{suitGlyph}</Text>
    </View>
  );

  if (onPress === undefined) {
    return (
      <View
        accessibilityLabel={tileAccessibleName(tile)}
        style={[styles.tile, selected && styles.selected]}
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
  disabled: {
    opacity: 0.28,
  },
  honour: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 24,
    fontWeight: "800",
  },
  pressed: {
    transform: [{ translateY: 2 }],
  },
  rank: {
    fontFamily: "serif",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 22,
  },
  redHonour: {
    color: color.accent,
  },
  selected: {
    borderColor: color.accent,
    borderWidth: 3,
  },
  suit: {
    fontFamily: "serif",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 16,
  },
  suited: {
    alignItems: "center",
  },
  // A tile is the one deliberate exception to the 48x48 target minimum: a suit
  // row shows all nine ranks, which cannot each be 48 wide on a narrow phone
  // without wrapping mid-suit and breaking the row people scan. Height stays
  // comfortably above the minimum and tiles keep a real gap between them.
  tile: {
    alignItems: "center",
    aspectRatio: 0.72,
    backgroundColor: color.white,
    borderColor: color.ink,
    borderRadius: radius.tile,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 38,
    shadowColor: color.ink,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 0,
  },
});
