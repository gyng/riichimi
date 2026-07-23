import { canonicalTileIds, redFiveIds } from "@riichimi/score-core";
import type { TileId } from "@riichimi/score-core";
import { MahjongTile, color, space } from "@riichimi/ui";
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
  readonly showRedFives?: boolean | undefined;
}

export function TilePicker({ isDisabled, onSelect, showRedFives = false }: TilePickerProps) {
  return (
    <View style={styles.root}>
      {rows.map((row) => (
        <View key={row.label} style={styles.rowSection}>
          <Text style={styles.label}>{row.label.toUpperCase()}</Text>
          <View style={styles.tiles}>
            {row.tiles.map((tile) => (
              <View key={tile} style={styles.slot}>
                <MahjongTile
                  disabled={isDisabled(tile)}
                  fill
                  onPress={() => onSelect(tile)}
                  tile={tile}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
      {showRedFives ? (
        <View style={styles.rowSection}>
          <Text style={styles.label}>RED FIVES</Text>
          <View style={styles.tiles}>
            {redFiveIds.map((tile) => (
              <View key={tile} style={styles.slot}>
                <MahjongTile
                  disabled={isDisabled(tile)}
                  fill
                  onPress={() => onSelect(tile)}
                  tile={tile}
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}
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
    marginBottom: 4,
  },
  root: {
    gap: space.x3,
  },
  // The label sits above the tiles: beside them it stole 86px of width, which
  // wrapped every nine-tile suit onto three lines on a phone.
  rowSection: { alignItems: "stretch" },
  slot: { flexBasis: 0, flexGrow: 1, flexShrink: 1, maxWidth: 42, minWidth: 0 },
  // One suit, one row: each tile takes an equal share of the width.
  tiles: { flexDirection: "row", gap: 4 },
});
