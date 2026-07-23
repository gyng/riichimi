import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { ReactNode } from "react";

import { SectionLabel } from "../atoms/section-label";
import { MethodCard } from "../molecules/method-card";
import { color, space } from "../tokens/theme";

export interface CalculatorLandingProps {
  readonly hasActiveSession: boolean;
  readonly historyCount: number;
  readonly onHistory: () => void;
  readonly onManual: () => void;
  readonly onScan: () => void;
  readonly onSession: () => void;
  readonly rulesControl?: ReactNode | undefined;
}

export function CalculatorLanding({
  hasActiveSession,
  historyCount,
  onHistory,
  onManual,
  onScan,
  onSession,
  rulesControl,
}: CalculatorLandingProps) {
  const { width } = useWindowDimensions();
  const usesWideLayout = width >= 760;

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <SectionLabel>Winning hand calculator</SectionLabel>
        <Text accessibilityRole="header" style={styles.headline}>
          Score a winning hand
        </Text>
        <Text style={styles.intro}>
          Scan the tiles or enter them by hand. Riichimi asks only what the table cannot show and
          explains every point — locally, on this device.
        </Text>
      </View>

      {rulesControl}

      <View style={[styles.methods, usesWideLayout && styles.methodsWide]}>
        <View style={styles.methodSlot}>
          <MethodCard
            actionLabel="Scan a winning hand"
            body="Use a guided camera frame to recognize tiles, calls, the winning tile, and dora indicators."
            index="01 / RECOMMENDED"
            onPress={onScan}
            primary
            title="Let the tiles speak"
          />
        </View>
        <View style={styles.methodSlot}>
          <MethodCard
            actionLabel="Enter tiles manually"
            body="Build the same auditable result without camera access. Nothing important is hidden behind automation."
            index="02 / MANUAL"
            onPress={onManual}
            title="Keep full control"
          />
        </View>
      </View>

      <Pressable
        accessibilityLabel={
          hasActiveSession ? "Resume the active table" : "Start a four-player table"
        }
        accessibilityRole="button"
        onPress={onSession}
        style={({ pressed }) => [styles.sessionCard, pressed && styles.sessionPressed]}
      >
        <View>
          <Text style={styles.sessionKicker}>03 / TABLE SESSION</Text>
          <Text style={styles.sessionTitle}>
            {hasActiveSession ? "Resume the active table" : "Start a four-player table"}
          </Text>
        </View>
        <Text style={styles.sessionArrow}>→</Text>
      </Pressable>

      <Pressable
        accessibilityLabel={historyCount === 0 ? "Keep the next answer" : "Revisit recent answers"}
        accessibilityRole="button"
        onPress={onHistory}
        style={({ pressed }) => [styles.historyCard, pressed && styles.sessionPressed]}
      >
        <View style={styles.historyNumberBlock}>
          <Text style={styles.historyNumber}>{String(historyCount).padStart(2, "0")}</Text>
          <Text style={styles.historyCountLabel}>SAVED</Text>
        </View>
        <View style={styles.historyCopy}>
          <Text style={styles.historyKicker}>SCORE FOLIO</Text>
          <Text style={styles.historyTitle}>
            {historyCount === 0 ? "Keep the next answer" : "Revisit recent answers"}
          </Text>
          <Text style={styles.historyBody}>Local score audits, ready when the table asks why.</Text>
        </View>
        <Text style={styles.sessionArrow}>→</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  headline: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 38,
    marginBottom: space.x3,
    marginTop: space.x2,
    maxWidth: 680,
  },
  hero: {
    marginBottom: space.x6,
    marginTop: space.x4,
  },
  intro: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 650,
  },
  historyBody: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 13,
    marginTop: 3,
  },
  historyCard: {
    alignItems: "center",
    borderBottomColor: color.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: space.x4,
    minHeight: 88,
    paddingHorizontal: space.x2,
    paddingVertical: space.x3,
  },
  historyCopy: { flex: 1 },
  historyCountLabel: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 7,
    letterSpacing: 0.8,
  },
  historyKicker: {
    color: color.jade,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  historyNumber: { color: color.accent, fontFamily: "serif", fontSize: 25, fontWeight: "800" },
  historyNumberBlock: { alignItems: "center", width: 48 },
  historyTitle: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  methodSlot: {
    flex: 1,
    minWidth: 280,
  },
  methods: {
    gap: space.x4,
  },
  methodsWide: {
    flexDirection: "row",
  },
  root: {
    alignSelf: "center",
    maxWidth: 1100,
    paddingBottom: space.x7,
    paddingHorizontal: space.x5,
    paddingTop: space.x5,
    width: "100%",
  },
  sessionArrow: {
    color: color.accent,
    fontFamily: "serif",
    fontSize: 26,
    fontWeight: "800",
  },
  sessionCard: {
    alignItems: "center",
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: space.x4,
    minHeight: 82,
    paddingHorizontal: space.x5,
    paddingVertical: space.x4,
  },
  sessionKicker: {
    color: color.jade,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  sessionPressed: {
    opacity: 0.72,
  },
  sessionTitle: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 3,
  },
});
