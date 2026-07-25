import { Text, View } from "../primitives";
import type { Styles } from "../primitives";

import { ActionButton } from "../atoms/action-button";
import { color, radius, space } from "../tokens/theme";

export interface MethodCardProps {
  readonly actionLabel: string;
  readonly body: string;
  readonly index: string;
  readonly onPress: () => void;
  readonly primary?: boolean;
  readonly title: string;
}

export function MethodCard({
  actionLabel,
  body,
  index,
  onPress,
  primary = false,
  title,
}: MethodCardProps) {
  return (
    <View style={[styles.card, primary && styles.primaryCard]}>
      <View style={styles.headingRow}>
        <Text aria-hidden style={[styles.index, primary && styles.primaryIndex]}>
          {index}
        </Text>
        <View style={styles.rule} />
      </View>
      <Text role="heading" style={[styles.title, primary && styles.primaryTitle]}>
        {title}
      </Text>
      <Text style={[styles.body, primary && styles.primaryBody]}>{body}</Text>
      <ActionButton
        label={actionLabel}
        onPress={onPress}
        variant={primary ? "vermilion" : "paper"}
      />
    </View>
  );
}

const styles = {
  body: {
    color: color.inkMuted,
    flexGrow: 1,
    fontFamily: "serif",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: space.x5,
  },
  card: {
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: radius.panel,
    borderWidth: 1,
    flex: 1,
    minHeight: 300,
    padding: space.x5,
  },
  headingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.x3,
    marginBottom: space.x6,
  },
  index: {
    color: color.accent,
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
  },
  primaryBody: {
    color: "#D8D8CF",
  },
  primaryCard: {
    backgroundColor: color.ink,
    borderColor: color.ink,
  },
  primaryIndex: {
    color: "#F06B4F",
  },
  primaryTitle: {
    color: color.white,
  },
  rule: {
    backgroundColor: color.line,
    flex: 1,
    height: 1,
  },
  title: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 29,
    fontWeight: "700",
    letterSpacing: -0.7,
    lineHeight: 34,
    marginBottom: space.x3,
  },
} satisfies Styles;
