import { scoringRulesProfile, scoringRulesProfiles } from "@riichimi/rules";
import { SegmentedControl, color, space } from "@riichimi/ui";
import { StyleSheet, Text, View } from "react-native";

import { useRules } from "../../state/rules-context";

import type { ScoringRules } from "@riichimi/score-core";

import { HouseRulesEditor } from "./house-rules-editor";
import { houseRulesProfileId, houseScoringRules } from "./house-rules";
import { parseRulesPreference } from "./rules-preference";

const options = [
  ...scoringRulesProfiles.map((profile) => ({ label: profile.label, value: profile.id })),
  { label: "House rules", value: houseRulesProfileId },
];

/**
 * Describe a profile from its actual options rather than prose, so the summary
 * cannot drift from what the scorer does.
 */
function describeProfile(profile: ScoringRules): string {
  return [
    profile.redFives ? "red fives" : "no red fives",
    profile.allowOpenTanyao ? "open tanyao" : "closed tanyao only",
    profile.kiriageMangan ? "round-up mangan" : "no round-up mangan",
    profile.countedLimit === "yonbaiman" ? "kazoe yakuman" : "counted hands cap at sanbaiman",
    profile.uraDora ? "ura-dora" : "no ura-dora",
    profile.yakumanStacking === "single" ? "yakuman never combine" : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

export function RulesProfileControl({
  lockedProfileId,
}: {
  readonly lockedProfileId?: string | undefined;
}) {
  const rules = useRules();
  const activeId = lockedProfileId ?? rules.activeRules.id;
  const isHouse = activeId === houseRulesProfileId;
  const selected = isHouse ? houseScoringRules(rules.houseRules) : scoringRulesProfile(activeId);
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
            : describeProfile(selected)}
        </Text>
      </View>
      {locked ? null : (
        <View style={styles.control}>
          <SegmentedControl
            accessibilityLabel="Scoring rules profile"
            onChange={(value) => {
              rules.selectProfile(parseRulesPreference(value));
            }}
            options={options}
            value={selected.id}
          />
        </View>
      )}
      {isHouse ? (
        <View style={styles.editor}>
          <HouseRulesEditor locked={locked} />
        </View>
      ) : null}
      {rules.storageError === null ? null : (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {rules.storageError}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Must be able to shrink to the row, or the profile options size to their own
  // content and overflow the screen instead of wrapping.
  control: { flexGrow: 1, flexShrink: 1, minWidth: 240 },
  copy: { flex: 1, minWidth: 250 },
  editor: { width: "100%" },
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
