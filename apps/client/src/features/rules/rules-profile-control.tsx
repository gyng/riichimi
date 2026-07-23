import { isScoringRulesProfileId, scoringRulesProfile, scoringRulesProfiles } from "@richii/rules";
import { SegmentedControl, color, space } from "@richii/ui";
import { StyleSheet, Text, View } from "react-native";

import { useRules } from "../../state/rules-context";

const options = scoringRulesProfiles.map((profile) => ({
  label: profile.redFives ? "WRC + red fives" : "WRC 2025",
  value: profile.id,
}));

export function RulesProfileControl({
  lockedProfileId,
}: {
  readonly lockedProfileId?: string | undefined;
}) {
  const rules = useRules();
  const selected = scoringRulesProfile(lockedProfileId ?? rules.activeRules.id);
  const locked = lockedProfileId !== undefined;

  return (
    <View style={styles.root}>
      <View style={styles.copy}>
        <Text style={styles.kicker}>
          SCORING RULES · {locked ? "PINNED TO TABLE" : "SAVED LOCALLY"}
        </Text>
        <Text accessibilityRole="header" style={styles.title}>
          {selected.label}
        </Text>
        <Text style={styles.note}>
          {locked
            ? "This table keeps the profile chosen at East 1, including through undo and reload."
            : "The red-five table profile is WRC 2025 with one explicit local change: red fives are enabled and counted as dora."}
        </Text>
      </View>
      {locked ? null : (
        <View style={styles.control}>
          <SegmentedControl
            accessibilityLabel="Scoring rules profile"
            onChange={(value) => {
              if (isScoringRulesProfileId(value)) {
                rules.selectProfile(value);
              }
            }}
            options={options}
            value={selected.id}
          />
        </View>
      )}
      {rules.storageError === null ? null : (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {rules.storageError}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  control: { minWidth: 280 },
  copy: { flex: 1, minWidth: 250 },
  error: { color: color.accent, fontFamily: "serif", fontSize: 13, width: "100%" },
  kicker: {
    color: color.jade,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  note: { color: color.inkMuted, fontFamily: "serif", fontSize: 13, lineHeight: 19, marginTop: 3 },
  root: {
    alignItems: "center",
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x4,
    marginBottom: space.x5,
    padding: space.x4,
  },
  title: { color: color.ink, fontFamily: "serif", fontSize: 18, fontWeight: "700", marginTop: 2 },
});
