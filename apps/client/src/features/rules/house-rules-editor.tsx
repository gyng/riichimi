import { SegmentedControl, color, space } from "@riichimi/ui";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useRules } from "../../state/rules-context";
import type { HouseRules } from "./house-rules";

const limitOptions = [
  { label: "Kazoe yakuman", value: "yonbaiman" },
  { label: "Cap at sanbaiman", value: "sanbaiman" },
] as const;

const windFuOptions = [
  { label: "2 fu", value: "2" },
  { label: "4 fu", value: "4" },
] as const;

const stackingOptions = [
  { label: "Add up", value: "additive" },
  { label: "Never combine", value: "single" },
] as const;

const toggles = [
  { key: "redFives", label: "Red fives count as dora" },
  { key: "allowOpenTanyao", label: "Open tanyao (kuitan)" },
  { key: "kiriageMangan", label: "Round-up mangan" },
  { key: "uraDora", label: "Ura-dora" },
] as const satisfies readonly { key: keyof HouseRules; label: string }[];

/**
 * Lets a table state its own rules. Editing is blocked while a table is pinned
 * to this profile: a running table's scoring must not change under it.
 */
export function HouseRulesEditor({ locked }: { readonly locked: boolean }) {
  const rules = useRules();
  const house = rules.houseRules;

  function update(patch: Partial<HouseRules>) {
    rules.saveHouseRules({ ...house, ...patch });
  }

  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>HOUSE RULES · THIS DEVICE</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Rules your table plays by
      </Text>
      <Text style={styles.note}>
        {locked
          ? "A table is using these rules. End it before changing them, so a hand already scored cannot be re-valued underneath the table."
          : "Not a published ruleset. Everything not listed here follows World Riichi Rules 2025."}
      </Text>

      <Text style={styles.fieldLabel}>NAME</Text>
      <TextInput
        accessibilityLabel="House rules name"
        editable={!locked}
        onChangeText={(label) => update({ label })}
        placeholder="House rules"
        style={[styles.input, locked && styles.disabled]}
        value={house.label}
      />

      {toggles.map((toggle) => (
        <Pressable
          accessibilityRole="checkbox"
          aria-checked={house[toggle.key]}
          accessibilityState={{ checked: house[toggle.key], disabled: locked }}
          disabled={locked}
          key={toggle.key}
          onPress={() => update({ [toggle.key]: !house[toggle.key] })}
          style={[styles.toggleRow, locked && styles.disabled]}
        >
          <View style={[styles.checkbox, house[toggle.key] && styles.checked]}>
            <Text style={styles.checkmark}>{house[toggle.key] ? "✓" : ""}</Text>
          </View>
          <Text style={styles.toggleLabel}>{toggle.label}</Text>
        </Pressable>
      ))}

      <Text style={styles.fieldLabel}>13+ HAN WITHOUT A YAKUMAN</Text>
      <SegmentedControl
        accessibilityLabel="Counted limit"
        onChange={(countedLimit) => {
          if (!locked) {
            update({ countedLimit });
          }
        }}
        options={limitOptions}
        value={house.countedLimit}
      />

      <Text style={styles.fieldLabel}>COMBINED YAKUMAN</Text>
      <SegmentedControl
        accessibilityLabel="Combined yakuman"
        onChange={(yakumanStacking) => {
          if (!locked) {
            update({ yakumanStacking });
          }
        }}
        options={stackingOptions}
        value={house.yakumanStacking}
      />

      <Text style={styles.fieldLabel}>PAIR THAT IS BOTH WINDS</Text>
      <SegmentedControl
        accessibilityLabel="Double wind pair fu"
        onChange={(value) => {
          if (!locked) {
            update({ doubleWindPairFu: value === "4" ? 4 : 2 });
          }
        }}
        options={windFuOptions}
        value={house.doubleWindPairFu === 4 ? "4" : "2"}
      />
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
  disabled: { opacity: 0.45 },
  fieldLabel: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: space.x2,
    marginTop: space.x4,
  },
  input: {
    backgroundColor: color.white,
    borderColor: color.line,
    borderRadius: 8,
    borderWidth: 1,
    color: color.ink,
    fontFamily: "serif",
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: space.x3,
  },
  kicker: {
    color: color.accent,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  note: { color: color.inkMuted, fontFamily: "serif", fontSize: 13, lineHeight: 19, marginTop: 3 },
  root: {
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: space.x5,
    padding: space.x4,
  },
  title: { color: color.ink, fontFamily: "serif", fontSize: 18, fontWeight: "700", marginTop: 2 },
  toggleLabel: { color: color.ink, flex: 1, fontFamily: "serif", fontSize: 15 },
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.x3,
    minHeight: 48,
  },
});
