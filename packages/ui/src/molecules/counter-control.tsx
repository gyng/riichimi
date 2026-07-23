import { Pressable, StyleSheet, Text, View } from "react-native";

import { color, radius, space } from "../tokens/theme";

export interface CounterControlProps {
  readonly label: string;
  readonly maximum?: number;
  readonly minimum?: number;
  readonly onChange: (value: number) => void;
  readonly value: number;
}

export function CounterControl({
  label,
  maximum = 99,
  minimum = 0,
  onChange,
  value,
}: CounterControlProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <Pressable
          accessibilityLabel={`Decrease ${label}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: value <= minimum }}
          disabled={value <= minimum}
          onPress={() => onChange(value - 1)}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>−</Text>
        </Pressable>
        <Text accessibilityLabel={`${label}: ${value}`} style={styles.value}>
          {value}
        </Text>
        <Pressable
          accessibilityLabel={`Increase ${label}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: value >= maximum }}
          disabled={value >= maximum}
          onPress={() => onChange(value + 1)}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: radius.control,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  buttonLabel: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 22,
    fontWeight: "800",
  },
  controls: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.x2,
  },
  label: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  pressed: {
    opacity: 0.65,
  },
  root: {
    gap: space.x2,
  },
  value: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 20,
    fontWeight: "800",
    minWidth: 32,
    textAlign: "center",
  },
});
