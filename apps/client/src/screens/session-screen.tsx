import type { Wind } from "@richii/score-core";
import { scoringRulesProfile } from "@richii/rules";
import { ActionButton, color, space } from "@richii/ui";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { createRoundCommandMetadata, useSession } from "../state/session-context";
import { RulesProfileControl } from "../features/rules/rules-profile-control";

const windNames: Record<Wind, string> = {
  east: "East",
  north: "North",
  south: "South",
  west: "West",
};
const seatNames = ["East", "South", "West", "North"] as const;

function points(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function SessionScreen() {
  const session = useSession();
  const [names, setNames] = useState(["Player 1", "Player 2", "Player 3", "Player 4"]);
  const [tenpai, setTenpai] = useState<readonly number[]>([]);
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (session.loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={color.accent} />
        <Text style={styles.muted}>Opening the local table…</Text>
      </SafeAreaView>
    );
  }

  if (session.state === null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.topBar}>
            <ActionButton label="Back" onPress={() => router.back()} variant="paper" />
          </View>
          <Text style={styles.kicker}>LOCAL TABLE SESSION</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Let the round remember itself.
          </Text>
          <Text style={styles.intro}>
            Start at 25,000 points. Richii carries the dealer, winds, honba, riichi pool, score
            transfers, and hand history into each calculation.
          </Text>
          <RulesProfileControl />
          <View style={styles.panel}>
            <Text accessibilityRole="header" style={styles.panelTitle}>
              Four players
            </Text>
            <View style={styles.nameGrid}>
              {names.map((name, index) => (
                <View key={index} style={styles.nameField}>
                  <Text style={styles.label}>
                    PLAYER {index + 1} · {seatNames[index]}
                  </Text>
                  <TextInput
                    accessibilityLabel={`Player ${index + 1} name`}
                    autoCapitalize="words"
                    maxLength={24}
                    onChangeText={(value) =>
                      setNames((current) =>
                        current.map((item, itemIndex) => (itemIndex === index ? value : item)),
                      )
                    }
                    selectTextOnFocus
                    style={styles.input}
                    value={name}
                  />
                </View>
              ))}
            </View>
            <View style={styles.primaryAction}>
              <ActionButton
                disabled={names.some((name) => name.trim().length === 0)}
                label="Start East 1"
                onPress={() => session.createTable(names)}
                variant="vermilion"
              />
            </View>
          </View>
          {session.storageError === null ? null : (
            <Text style={styles.error}>{session.storageError}</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const table = session.state.table;
  const tableRules = scoringRulesProfile(table.rulesProfileId);

  function toggleTenpai(index: number) {
    setTenpai((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <ActionButton label="Back" onPress={() => router.back()} variant="paper" />
          <Text style={styles.rules}>{tableRules.label.toUpperCase()} · PINNED</Text>
        </View>
        <Text style={styles.kicker}>ACTIVE TABLE</Text>
        <Text accessibilityRole="header" style={styles.roundTitle}>
          {windNames[table.roundWind]} {table.handNumber}
        </Text>
        <Text
          accessibilityLabel={`${table.honba} honba, ${table.riichiSticks} riichi ${table.riichiSticks === 1 ? "stick" : "sticks"}`}
          style={styles.roundMeta}
        >
          {table.honba} honba · {table.riichiSticks} riichi stick
          {table.riichiSticks === 1 ? "" : "s"}
        </Text>

        <View style={styles.playerGrid}>
          {table.players.map((player, index) => {
            const seat = seatNames[(index - table.dealerIndex + 4) % 4];
            const hasDeclared = table.declaredRiichiPlayerIndices.includes(index);
            return (
              <View
                key={player.id}
                style={[styles.playerCard, index === table.dealerIndex && styles.dealerCard]}
              >
                <Text style={styles.label}>
                  {seat}
                  {index === table.dealerIndex ? " · DEALER" : ""}
                </Text>
                <Text style={styles.playerName}>{player.name}</Text>
                <Text style={styles.playerScore}>{points(player.score)}</Text>
                <ActionButton
                  disabled={hasDeclared || player.score < 1000}
                  label={hasDeclared ? "Riichi declared" : "Declare riichi"}
                  onPress={() => session.declarePlayerRiichi(index)}
                  variant="paper"
                />
              </View>
            );
          })}
        </View>

        <View style={styles.actionPanel}>
          <View style={styles.actionCopy}>
            <Text accessibilityRole="header" style={styles.panelTitle}>
              Record the next result
            </Text>
            <Text style={styles.muted}>
              The calculator inherits this round’s context and applies every transfer.
            </Text>
          </View>
          <ActionButton
            label="Score a winning hand"
            onPress={() => router.push("/manual")}
            variant="vermilion"
          />
        </View>

        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.panelTitle}>
            Exhaustive draw
          </Text>
          <Text style={styles.muted}>
            Select tenpai players. The 3,000-point noten payment and dealer continuation are
            automatic.
          </Text>
          <View style={styles.tenpaiRow}>
            {table.players.map((player, index) => {
              const selected = tenpai.includes(index);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  key={player.id}
                  onPress={() => toggleTenpai(index)}
                  style={[styles.tenpaiChip, selected && styles.selectedChip]}
                >
                  <Text style={[styles.tenpaiText, selected && styles.selectedChipText]}>
                    {player.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.primaryAction}>
            <ActionButton
              label="Record draw & advance"
              onPress={() => {
                session.recordDraw({
                  ...createRoundCommandMetadata(),
                  tenpaiPlayerIndices: tenpai,
                });
                setTenpai([]);
              }}
              variant="paper"
            />
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.historyHeader}>
            <Text accessibilityRole="header" style={styles.panelTitle}>
              Round history
            </Text>
            <ActionButton
              disabled={session.state.undoStack.length === 0}
              label="Undo last change"
              onPress={session.undo}
              variant="paper"
            />
          </View>
          {table.history.length === 0 ? (
            <Text style={styles.muted}>No completed rounds yet.</Text>
          ) : (
            table.history.toReversed().map((record) => (
              <View key={record.id} style={styles.historyRow}>
                <View>
                  <Text style={styles.historyTitle}>
                    {windNames[record.roundWind]} {record.handNumber} ·{" "}
                    {record.kind === "win"
                      ? `${table.players[record.winnerIndex]?.name ?? "Winner"} won`
                      : "Exhaustive draw"}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {record.honba} honba · {new Date(record.occurredAt).toLocaleString()}
                  </Text>
                </View>
                <Text style={styles.delta}>
                  {record.deltas
                    .map((delta) =>
                      delta === 0 ? "±0" : `${delta > 0 ? "+" : ""}${points(delta)}`,
                    )
                    .join("  ")}
                </Text>
              </View>
            ))
          )}
        </View>

        {session.storageError === null ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {session.storageError}
          </Text>
        )}
        {confirmEnd ? (
          <View style={styles.endConfirm}>
            <Text style={styles.endTitle}>End this table and erase its local history?</Text>
            <View style={styles.endActions}>
              <ActionButton
                label="Keep table"
                onPress={() => setConfirmEnd(false)}
                variant="paper"
              />
              <ActionButton
                label="End & erase"
                onPress={session.clearSession}
                variant="vermilion"
              />
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirmEnd(true)}
            style={styles.endLink}
          >
            <Text style={styles.endLinkText}>End this table</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionCopy: { flex: 1, minWidth: 240 },
  actionPanel: {
    alignItems: "center",
    backgroundColor: color.jade,
    borderRadius: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x5,
    justifyContent: "space-between",
    marginBottom: space.x5,
    padding: space.x5,
  },
  centered: {
    alignItems: "center",
    backgroundColor: color.canvas,
    flex: 1,
    gap: space.x3,
    justifyContent: "center",
  },
  content: {
    alignSelf: "center",
    maxWidth: 1000,
    padding: space.x5,
    paddingBottom: space.x8,
    width: "100%",
  },
  dealerCard: { borderColor: color.accent, borderWidth: 2 },
  delta: { color: color.jade, fontFamily: "monospace", fontSize: 11, fontWeight: "700" },
  endActions: { flexDirection: "row", flexWrap: "wrap", gap: space.x3 },
  endConfirm: {
    backgroundColor: "#F6DCD4",
    borderColor: color.accent,
    borderRadius: 12,
    borderWidth: 1,
    gap: space.x3,
    marginTop: space.x4,
    padding: space.x4,
  },
  endLink: { alignSelf: "flex-start", marginTop: space.x4, paddingVertical: space.x3 },
  endLinkText: {
    color: color.accent,
    fontFamily: "serif",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  endTitle: { color: color.ink, fontFamily: "serif", fontSize: 17, fontWeight: "700" },
  error: { color: color.accent, fontFamily: "serif", fontSize: 14, marginTop: space.x3 },
  historyHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x4,
    justifyContent: "space-between",
  },
  historyMeta: { color: color.inkMuted, fontFamily: "serif", fontSize: 12, marginTop: 2 },
  historyRow: {
    alignItems: "center",
    borderTopColor: color.line,
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x4,
    justifyContent: "space-between",
    paddingVertical: space.x3,
  },
  historyTitle: { color: color.ink, fontFamily: "serif", fontSize: 15, fontWeight: "700" },
  input: {
    backgroundColor: color.white,
    borderColor: color.line,
    borderRadius: 8,
    borderWidth: 1,
    color: color.ink,
    fontFamily: "serif",
    fontSize: 17,
    minHeight: 48,
    paddingHorizontal: space.x3,
  },
  intro: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 18,
    lineHeight: 28,
    marginBottom: space.x6,
    maxWidth: 720,
  },
  kicker: {
    color: color.accent,
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: space.x7,
  },
  label: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  muted: { color: color.inkMuted, fontFamily: "serif", fontSize: 14, lineHeight: 21 },
  nameField: { flex: 1, gap: space.x2, minWidth: 220 },
  nameGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.x4 },
  panel: {
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: 16,
    borderWidth: 1,
    gap: space.x4,
    marginBottom: space.x5,
    padding: space.x5,
  },
  panelTitle: { color: color.ink, fontFamily: "serif", fontSize: 23, fontWeight: "800" },
  playerCard: {
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: space.x2,
    minWidth: 210,
    padding: space.x4,
  },
  playerGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.x3, marginBottom: space.x5 },
  playerName: { color: color.ink, fontFamily: "serif", fontSize: 19, fontWeight: "700" },
  playerScore: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: -0.8,
    marginBottom: space.x2,
  },
  primaryAction: { alignSelf: "flex-start", marginTop: space.x2 },
  roundMeta: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: space.x5,
  },
  roundTitle: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -1.5,
    lineHeight: 52,
    marginTop: space.x2,
  },
  rules: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  safeArea: { backgroundColor: color.canvas, flex: 1 },
  selectedChip: { backgroundColor: color.ink, borderColor: color.ink },
  selectedChipText: { color: color.white },
  tenpaiChip: {
    backgroundColor: color.canvas,
    borderColor: color.line,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 42,
    paddingHorizontal: space.x4,
    paddingVertical: space.x3,
  },
  tenpaiRow: { flexDirection: "row", flexWrap: "wrap", gap: space.x2 },
  tenpaiText: { color: color.ink, fontFamily: "serif", fontSize: 14, fontWeight: "700" },
  title: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 47,
    fontWeight: "800",
    letterSpacing: -1.7,
    lineHeight: 51,
    marginBottom: space.x4,
    marginTop: space.x2,
    maxWidth: 700,
  },
  topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
});
