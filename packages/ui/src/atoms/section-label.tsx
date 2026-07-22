import { StyleSheet, Text } from "react-native";

import { color } from "../tokens/theme";

export interface SectionLabelProps {
  readonly children: string;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return <Text style={styles.label}>{children.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  label: {
    color: color.accent,
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
  },
});
