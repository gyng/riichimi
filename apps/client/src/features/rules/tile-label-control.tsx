import { color, space } from "@riichimi/ui";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTileLabels } from "../../state/tile-display-context";
import { useLocale } from "../../state/locale-context";

export function TileLabelControl() {
  const { t } = useLocale();
  const { setShowRankLabels, showRankLabels } = useTileLabels();

  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>{t("TILES \u00b7 THIS DEVICE")}</Text>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: showRankLabels }}
        aria-checked={showRankLabels}
        onPress={() => setShowRankLabels(!showRankLabels)}
        style={styles.row}
      >
        <View style={[styles.checkbox, showRankLabels && styles.checked]}>
          <Text style={styles.checkmark}>{showRankLabels ? "✓" : ""}</Text>
        </View>
        <Text style={styles.label}>{t("Show the rank in the tile corner")}</Text>
      </Pressable>
      <Text style={styles.note}>
        {t(
          "Adds a small 5p or 3s to each tile face. Useful while you are still reading tiles by sight.",
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  checkbox: {
    alignItems: "center",
    backgroundColor: color.paper,
    borderColor: color.ink,
    borderRadius: 4,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  checked: { backgroundColor: color.ink },
  checkmark: { color: color.white, fontSize: 13, fontWeight: "800" },
  kicker: {
    color: color.jade,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  label: { color: color.ink, flex: 1, fontFamily: "serif", fontSize: 15 },
  note: { color: color.inkMuted, fontFamily: "serif", fontSize: 13, lineHeight: 19 },
  root: {
    flexBasis: 320,
    flexGrow: 1,
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: space.x5,
    padding: space.x4,
  },
  row: { alignItems: "center", flexDirection: "row", gap: space.x3, minHeight: 48 },
});
