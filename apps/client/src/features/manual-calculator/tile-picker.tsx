import { canonicalTileIds } from "@richii/score-core";
import type { TileId } from "@richii/score-core";
import { MahjongTile, color, space } from "@richii/ui";
import { StyleSheet, Text, View } from "react-native";

const rows = [
  { label: "Characters", tiles: canonicalTileIds.slice(0, 9) },
  { label: "Circles", tiles: canonicalTileIds.slice(9, 18) },
  { label: "Bamboo", tiles: canonicalTileIds.slice(18, 27) },
  { label: "Honours", tiles: canonicalTileIds.slice(27) },
] as const;

export interface TilePickerProps {
  readonly isDisabled: (tile: TileId) => boolean;
  readonly onSelect: (tile: TileId) => void;
}

export function TilePicker({ isDisabled, onSelect }: TilePickerProps) {
  return (
    <View style={styles.root}>
      {rows.map((row) => (
        <View key={row.label} style={styles.rowSection}>
          <Text style={styles.label}>{row.label.toUpperCase()}</Text>
          <View style={styles.tiles}>
            {row.tiles.map((tile) => (
              <MahjongTile
                disabled={isDisabled(tile)}
                key={tile}
                onPress={() => onSelect(tile)}
                tile={tile}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    minWidth: 74,
    paddingTop: 18,
  },
  root: {
    gap: space.x3,
  },
  rowSection: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.x3,
  },
  tiles: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
});
