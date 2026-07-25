import { Pressable, Text, View } from "../primitives";
import type { Styles } from "../primitives";
import type { ReactNode } from "react";

import { color, space } from "../tokens/theme";

/** Every user-facing string, supplied by the app so it can be translated. */
export interface CalculatorLandingCopy {
  readonly headline: string;
  readonly historyEmpty: string;
  readonly historyLabel: string;
  readonly manualAction: string;
  readonly scanAction: string;
  readonly sessionResume: string;
  readonly sessionStart: string;
}

export interface CalculatorLandingProps {
  readonly copy: CalculatorLandingCopy;
  readonly hasActiveSession: boolean;
  readonly historyCount: number;
  readonly onHistory: () => void;
  readonly onManual: () => void;
  readonly onScan: () => void;
  readonly onSession: () => void;
  readonly rulesControl?: ReactNode | undefined;
}

export function CalculatorLanding({
  copy,
  hasActiveSession,
  historyCount,
  onHistory,
  onManual,
  onScan,
  onSession,
  rulesControl,
}: CalculatorLandingProps) {
  return (
    <View style={styles.root}>
      <Text role="heading" style={styles.headline}>
        {copy.headline}
      </Text>

      <View style={styles.actions}>
        <Pressable
          aria-label={copy.scanAction}
          onPress={onScan}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryLabel}>{copy.scanAction}</Text>
        </Pressable>
        <Pressable
          aria-label={copy.manualAction}
          onPress={onManual}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryLabel}>{copy.manualAction}</Text>
        </Pressable>
      </View>

      <Pressable
        aria-label={hasActiveSession ? copy.sessionResume : copy.sessionStart}
        onPress={onSession}
        style={({ pressed }) => [
          styles.row,
          hasActiveSession && styles.rowActive,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.rowLabel}>
          {hasActiveSession ? copy.sessionResume : copy.sessionStart}
        </Text>
        <Text style={styles.rowArrow}>→</Text>
      </Pressable>

      <Pressable
        aria-label={historyCount === 0 ? copy.historyEmpty : copy.historyLabel}
        disabled={historyCount === 0}
        onPress={onHistory}
        style={({ pressed }) => [
          styles.row,
          historyCount === 0 && styles.rowMuted,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.rowLabel}>
          {historyCount === 0 ? copy.historyEmpty : copy.historyLabel}
        </Text>
        {historyCount === 0 ? null : (
          <Text style={styles.rowCount}>{String(historyCount).padStart(2, "0")}</Text>
        )}
      </Pressable>

      {rulesControl}
    </View>
  );
}

const styles = {
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.x3, marginTop: space.x4 },
  headline: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  pressed: { opacity: 0.72 },
  primary: {
    alignItems: "center",
    backgroundColor: color.accent,
    borderRadius: 12,
    flexBasis: 160,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 64,
    paddingHorizontal: space.x4,
  },
  primaryLabel: { color: color.white, fontFamily: "serif", fontSize: 17, fontWeight: "800" },
  row: {
    alignItems: "center",
    borderColor: color.line,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.x3,
    justifyContent: "space-between",
    marginTop: space.x3,
    minHeight: 56,
    paddingHorizontal: space.x4,
  },
  rowActive: { borderColor: color.accent, borderWidth: 2 },
  rowArrow: { color: color.accent, fontFamily: "serif", fontSize: 20, fontWeight: "800" },
  rowMuted: { opacity: 0.55 },
  rowCount: { color: color.accent, fontFamily: "monospace", fontSize: 15, fontWeight: "800" },
  rowLabel: { color: color.ink, flex: 1, fontFamily: "serif", fontSize: 16, fontWeight: "700" },
  root: {
    alignSelf: "center",
    maxWidth: 720,
    paddingBottom: space.x5,
    paddingHorizontal: space.x4,
    paddingTop: space.x4,
    width: "100%",
  },
  secondary: {
    alignItems: "center",
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: 160,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 64,
    paddingHorizontal: space.x4,
  },
  secondaryLabel: { color: color.ink, fontFamily: "serif", fontSize: 17, fontWeight: "800" },
} satisfies Styles;
