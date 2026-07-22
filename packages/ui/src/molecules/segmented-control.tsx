import { Pressable, StyleSheet, Text, View } from "react-native";

import { color, radius, space } from "../tokens/theme";

export interface SegmentOption<Value extends string> {
  readonly label: string;
  readonly value: Value;
}

export interface SegmentedControlProps<Value extends string> {
  readonly accessibilityLabel: string;
  readonly onChange: (value: Value) => void;
  readonly options: readonly SegmentOption<Value>[];
  readonly value: Value;
}

export function SegmentedControl<Value extends string>({
  accessibilityLabel,
  onChange,
  options,
  value,
}: SegmentedControlProps<Value>) {
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      style={styles.root}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              selected && styles.selectedOption,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 14,
    fontWeight: "700",
  },
  option: {
    alignItems: "center",
    borderRadius: radius.control - 2,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: space.x3,
    paddingVertical: space.x2,
  },
  pressed: {
    opacity: 0.72,
  },
  root: {
    alignSelf: "flex-start",
    backgroundColor: color.canvasDeep,
    borderColor: color.line,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 3,
  },
  selectedLabel: {
    color: color.white,
  },
  selectedOption: {
    backgroundColor: color.ink,
  },
});
