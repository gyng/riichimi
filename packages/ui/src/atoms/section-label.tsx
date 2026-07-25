import { Text } from "../primitives";
import type { Styles } from "../primitives";

import { color } from "../tokens/theme";

export interface SectionLabelProps {
  readonly children: string;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return <Text style={styles.label}>{children.toUpperCase()}</Text>;
}

const styles = {
  label: {
    color: color.accent,
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.8,
  },
} satisfies Styles;
