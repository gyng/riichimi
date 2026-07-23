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
      <View style={styles.masthead}>
        <View style={styles.brandMark} accessibilityElementsHidden>
          <Text style={styles.brandGlyph}>立</Text>
        </View>
        <View>
          <Text style={styles.brand}>RICHII</Text>
          <Text style={styles.brandNote}>RIICHI, READ CLEARLY</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <SectionLabel>Winning hand calculator</SectionLabel>
        <Text accessibilityRole="header" style={styles.headline}>
          Read the table.{"\n"}Not a form.
        </Text>
        <Text style={styles.intro}>
          Frame the winning hand once. Richii identifies the tiles, asks only what the table cannot
          show, and explains every point.
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

      <View style={styles.trustRow}>
        <Text style={styles.trustItem}>LOCAL BY DEFAULT</Text>
        <Text style={styles.trustItem}>UNCERTAINTY SHOWN</Text>
        <Text style={styles.trustItem}>SCORE EXPLAINED</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 2.4,
  },
  brandGlyph: {
    color: color.white,
    fontFamily: "serif",
    fontSize: 21,
    fontWeight: "700",
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: color.accent,
    borderRadius: 4,
    height: 40,
    justifyContent: "center",
    width: 32,
  },
  brandNote: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 8,
    letterSpacing: 1.3,
    marginTop: 2,
  },
  headline: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 54,
    fontWeight: "700",
    letterSpacing: -2.1,
    lineHeight: 57,
    marginBottom: space.x4,
    marginTop: space.x3,
    maxWidth: 680,
  },
  hero: {
    marginBottom: space.x7,
    marginTop: space.x7,
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
  masthead: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.x3,
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
  trustItem: {
    color: color.jade,
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  trustRow: {
    borderTopColor: color.line,
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x5,
    marginTop: space.x6,
    paddingTop: space.x4,
  },
});
