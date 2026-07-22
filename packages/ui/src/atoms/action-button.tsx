import { Pressable, StyleSheet, Text } from "react-native";

import { color, radius, space } from "../tokens/theme";

export interface ActionButtonProps {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: "ink" | "paper" | "vermilion";
}

export function ActionButton({
  disabled = false,
  label,
  onPress,
  variant = "ink",
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, variant === "paper" && styles.paperLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: radius.control,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: space.x5,
    paddingVertical: space.x3,
  },
  disabled: {
    opacity: 0.45,
  },
  ink: {
    backgroundColor: color.ink,
  },
  label: {
    color: color.white,
    fontFamily: "serif",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  paper: {
    backgroundColor: color.paper,
    borderColor: color.ink,
    borderWidth: 1,
  },
  paperLabel: {
    color: color.ink,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ translateY: 1 }],
  },
  vermilion: {
    backgroundColor: color.accent,
  },
});
