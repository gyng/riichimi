import { color, space } from "@riichimi/ui";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { speech } from "../../infrastructure/speech";
import { useAnnouncer } from "../../state/announcer-context";
import { useLocale } from "../../state/locale-context";

/** Setup control for reading a scored win aloud. Hidden where no voice exists. */
export function AnnounceControl() {
  const { t } = useLocale();
  const { announceWins, setAnnounceWins } = useAnnouncer();

  if (!speech.available) {
    return null;
  }

  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>{t("SOUND · THIS DEVICE")}</Text>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: announceWins }}
        aria-checked={announceWins}
        onPress={() => {
          const next = !announceWins;
          setAnnounceWins(next);
          if (!next) {
            speech.cancel();
          }
        }}
        style={styles.row}
      >
        <View style={[styles.checkbox, announceWins && styles.checked]}>
          <Text style={styles.checkmark}>{announceWins ? "✓" : ""}</Text>
        </View>
        <Text style={styles.label}>{t("Announce a win out loud")}</Text>
      </Pressable>
      <Text style={styles.note}>{t("Reads the han, fu, and points when a hand scores.")}</Text>
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
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: 320,
    flexGrow: 1,
    marginBottom: space.x5,
    padding: space.x4,
  },
  row: { alignItems: "center", flexDirection: "row", gap: space.x3, minHeight: 48 },
});
