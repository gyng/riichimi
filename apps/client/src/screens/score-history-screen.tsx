import { ActionButton, MahjongTile, color, space } from "@riichimi/ui";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { bodyEdges } from "../components/screen-insets";

import type { ScoreHistoryEntry } from "../features/score-history/score-history";
import { useScoreHistory } from "../state/score-history-context";
import { useLocale } from "../state/locale-context";

function points(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function scoreLabel(entry: ScoreHistoryEntry): string {
  return entry.result.limit === null
    ? `${entry.result.han ?? 0} han · ${entry.result.fu ?? 0} fu`
    : entry.result.limit.toUpperCase();
}

function paymentLabel(entry: ScoreHistoryEntry): string {
  const { payments } = entry.result;
  if (payments.kind === "ron") {
    return `${points(payments.fromDiscarder)} from discarder`;
  }
  return payments.fromDealer === null
    ? `${points(payments.fromEachNonDealer)} all`
    : `${points(payments.fromDealer)} / ${points(payments.fromEachNonDealer)}`;
}

function calculatedTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

export function ScoreHistoryScreen() {
  const { t } = useLocale();
  const history = useScoreHistory();
  const [confirmClear, setConfirmClear] = useState(false);

  if (history.loading) {
    return (
      <SafeAreaView edges={bodyEdges} style={styles.centered}>
        <ActivityIndicator color={color.accent} />
        <Text style={styles.muted}>Opening the score folio…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={bodyEdges} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Text style={styles.rules}>{t("SAVED LOCALLY \u00b7 LAST 20")}</Text>
        </View>

        <View style={styles.header}>
          <Text style={styles.kicker}>{t("SCORE FOLIO")}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {t("Every answer leaves a trail.")}
          </Text>
          <Text style={styles.intro}>
            Revisit the hand, context, yaku, and exact transfer behind recent standalone scores.
            Recalculating the same hand refreshes one entry instead of making duplicates.
          </Text>
        </View>

        {history.entries.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyNumber}>零</Text>
            <View style={styles.emptyCopy}>
              <Text accessibilityRole="header" style={styles.emptyTitle}>
                {t("No saved scores yet")}
              </Text>
              <Text style={styles.muted}>
                A successful standalone calculation appears here automatically. Table results stay
                with their round history.
              </Text>
              <View style={styles.emptyAction}>
                <ActionButton
                  label={t("Score a hand")}
                  onPress={() => router.push("/manual")}
                  variant="vermilion"
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.ledger}>
            {history.entries.map((entry, index) => (
              <View key={entry.id} style={styles.entry}>
                <View style={styles.entryRail}>
                  <Text style={styles.entryIndex}>{String(index + 1).padStart(2, "0")}</Text>
                  <View style={styles.railLine} />
                </View>
                <View style={styles.entryBody}>
                  <View style={styles.entryHeader}>
                    <View>
                      <Text style={styles.entryMeta}>{calculatedTime(entry.calculatedAt)}</Text>
                      <Text accessibilityRole="header" style={styles.score}>
                        {scoreLabel(entry)}
                      </Text>
                    </View>
                    <View style={styles.methodStamp}>
                      <Text style={styles.methodText}>{entry.context.method.toUpperCase()}</Text>
                    </View>
                  </View>

                  <View accessibilityLabel="Saved concealed hand" style={styles.tiles}>
                    {entry.hand.concealedTiles.map((tile, tileIndex) => (
                      <MahjongTile
                        key={`${entry.id}-${tile}-${tileIndex}`}
                        selected={
                          tile === entry.hand.winningTile &&
                          tileIndex === entry.hand.concealedTiles.lastIndexOf(tile)
                        }
                        tile={tile}
                      />
                    ))}
                  </View>

                  <View style={styles.factRow}>
                    <Text style={styles.fact}>
                      {entry.context.roundWind.toUpperCase()} ROUND ·{" "}
                      {entry.context.seatWind.toUpperCase()} SEAT
                    </Text>
                    <Text style={styles.fact}>
                      {entry.hand.meldCount} CALLS · {entry.hand.doraCount} INDICATORS
                    </Text>
                  </View>

                  <View style={styles.resultStrip}>
                    <View>
                      <Text style={styles.resultKicker}>{t("PAYMENT")}</Text>
                      <Text style={styles.payment}>{paymentLabel(entry)}</Text>
                    </View>
                    <View style={styles.totalBlock}>
                      <Text style={styles.resultKicker}>{t("TOTAL GAIN")}</Text>
                      <Text style={styles.total}>{points(entry.result.totalGain)}</Text>
                    </View>
                  </View>

                  <View style={styles.yakuRow}>
                    {(entry.result.yakuman.length > 0
                      ? entry.result.yakuman
                      : entry.result.yaku
                    ).map((item) => (
                      <View key={item.id} style={styles.yakuChip}>
                        <Text style={styles.yakuName}>{item.name}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.entryFooter}>
                    <Text style={styles.rulesLabel}>{entry.rules.label}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove score ${index + 1}`}
                      onPress={() => history.remove(entry.id)}
                      style={styles.removeButton}
                    >
                      <Text style={styles.removeText}>{t("Remove")}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {history.storageError === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {history.storageError}
          </Text>
        )}

        {history.entries.length === 0 ? null : confirmClear ? (
          <View style={styles.clearConfirm}>
            <Text style={styles.clearTitle}>
              {t("Erase every saved standalone score on this device?")}
            </Text>
            <View style={styles.clearActions}>
              <ActionButton
                label={t("Keep scores")}
                onPress={() => setConfirmClear(false)}
                variant="paper"
              />
              <ActionButton
                label={t("Erase score folio")}
                onPress={() => {
                  history.clear();
                  setConfirmClear(false);
                }}
                variant="vermilion"
              />
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirmClear(true)}
            style={styles.clearLink}
          >
            <Text style={styles.clearLinkText}>{t("Clear score folio")}</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    backgroundColor: color.canvas,
    flex: 1,
    gap: space.x3,
    justifyContent: "center",
  },
  clearActions: { flexDirection: "row", flexWrap: "wrap", gap: space.x3 },
  clearConfirm: {
    backgroundColor: color.paper,
    borderColor: color.accent,
    borderRadius: 12,
    borderWidth: 1,
    gap: space.x4,
    marginTop: space.x5,
    padding: space.x5,
  },
  clearLink: { alignSelf: "center", marginTop: space.x6, padding: space.x3 },
  clearLinkText: { color: color.accent, fontFamily: "serif", fontSize: 15, fontWeight: "700" },
  clearTitle: { color: color.ink, fontFamily: "serif", fontSize: 18, fontWeight: "700" },
  content: {
    alignSelf: "center",
    maxWidth: 980,
    paddingBottom: space.x8,
    paddingHorizontal: space.x5,
    paddingTop: space.x5,
    width: "100%",
  },
  emptyAction: { alignSelf: "flex-start", marginTop: space.x4 },
  emptyCopy: { flex: 1, maxWidth: 520 },
  emptyNumber: { color: color.canvasDeep, fontFamily: "serif", fontSize: 96, fontWeight: "900" },
  emptyPanel: {
    alignItems: "center",
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x6,
    padding: space.x6,
  },
  emptyTitle: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: space.x2,
  },
  entry: { flexDirection: "row" },
  entryBody: {
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    marginBottom: space.x5,
    padding: space.x5,
  },
  entryFooter: {
    alignItems: "center",
    borderTopColor: color.line,
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x3,
    justifyContent: "space-between",
    marginTop: space.x4,
    paddingTop: space.x3,
  },
  entryHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.x3,
    justifyContent: "space-between",
  },
  entryIndex: { color: color.accent, fontFamily: "monospace", fontSize: 11, fontWeight: "800" },
  entryMeta: { color: color.inkMuted, fontFamily: "monospace", fontSize: 9, letterSpacing: 0.7 },
  entryRail: { alignItems: "center", paddingRight: space.x3, paddingTop: space.x3, width: 34 },
  error: { color: color.accent, fontFamily: "serif", marginTop: space.x4 },
  fact: { color: color.inkMuted, fontFamily: "monospace", fontSize: 9, letterSpacing: 0.6 },
  factRow: { flexDirection: "row", flexWrap: "wrap", gap: space.x4, marginTop: space.x3 },
  header: { marginBottom: space.x6, marginTop: space.x7 },
  intro: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 650,
  },
  kicker: {
    color: color.accent,
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.7,
  },
  ledger: { marginTop: space.x2 },
  methodStamp: {
    borderColor: color.jade,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: space.x3,
    paddingVertical: space.x2,
  },
  methodText: { color: color.jade, fontFamily: "monospace", fontSize: 9, fontWeight: "800" },
  muted: { color: color.inkMuted, fontFamily: "serif", fontSize: 15, lineHeight: 22 },
  payment: { color: color.ink, fontFamily: "serif", fontSize: 17, fontWeight: "700", marginTop: 2 },
  railLine: { backgroundColor: color.line, flex: 1, marginTop: space.x2, width: 1 },
  removeButton: { minHeight: 48, paddingHorizontal: space.x2, justifyContent: "center" },
  removeText: { color: color.accent, fontFamily: "serif", fontSize: 14, fontWeight: "700" },
  resultKicker: { color: color.jade, fontFamily: "monospace", fontSize: 8, letterSpacing: 1 },
  resultStrip: {
    alignItems: "flex-end",
    backgroundColor: color.canvas,
    borderRadius: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x4,
    justifyContent: "space-between",
    marginTop: space.x4,
    padding: space.x4,
  },
  rules: { color: color.inkMuted, fontFamily: "monospace", fontSize: 9, letterSpacing: 1 },
  rulesLabel: { color: color.inkMuted, fontFamily: "monospace", fontSize: 9 },
  safeArea: { backgroundColor: color.canvas, flex: 1 },
  score: { color: color.ink, fontFamily: "serif", fontSize: 30, fontWeight: "800", marginTop: 3 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: space.x4 },
  title: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 50,
    fontWeight: "800",
    letterSpacing: -1.8,
    lineHeight: 54,
    marginBottom: space.x4,
    marginTop: space.x3,
  },
  topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  total: {
    color: color.accent,
    fontFamily: "serif",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 1,
  },
  totalBlock: { alignItems: "flex-end" },
  yakuChip: {
    borderColor: color.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: space.x3,
    paddingVertical: space.x2,
  },
  yakuName: { color: color.ink, fontFamily: "serif", fontSize: 12, fontWeight: "700" },
  yakuRow: { flexDirection: "row", flexWrap: "wrap", gap: space.x2, marginTop: space.x3 },
});
