import type { Wind } from "@richii/score-core";
import { scoringRulesProfile } from "@richii/rules";
import {
  editableRoundIds,
  formatSessionSummaryText,
  handRiichiPlayerIndices,
  summarizeSession,
} from "@richii/session-core";
import type {
  EditReview,
  EditWarning,
  RoundContextChange,
  RoundRecord,
  SessionEditCommand,
  SessionEditError,
} from "@richii/session-core";
import { ActionButton, color, space } from "@richii/ui";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
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

function toggle(current: readonly number[], index: number): readonly number[] {
  return current.includes(index) ? current.filter((item) => item !== index) : [...current, index];
}

export function SessionScreen() {
  const session = useSession();
  const [names, setNames] = useState(["Player 1", "Player 2", "Player 3", "Player 4"]);
  const [tenpai, setTenpai] = useState<readonly number[]>([]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [draftTenpai, setDraftTenpai] = useState<readonly number[]>([]);
  const [draftWinner, setDraftWinner] = useState(0);
  const [draftDiscarder, setDraftDiscarder] = useState<number | null>(null);
  const [draftRiichi, setDraftRiichi] = useState<readonly number[]>([]);
  const [pendingCommand, setPendingCommand] = useState<SessionEditCommand | null>(null);
  const [pendingReview, setPendingReview] = useState<EditReview | null>(null);
  const [editError, setEditError] = useState<SessionEditError | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);

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

  const sessionState = session.state;
  const table = sessionState.table;
  const tableRules = scoringRulesProfile(table.rulesProfileId);
  const summary = showSummary ? summarizeSession(sessionState) : null;
  const summaryText = summary === null ? "" : formatSessionSummaryText(summary);
  const editableIds = editableRoundIds(sessionState);
  const legacyHistory = table.history.length > 0 && editableIds.size === 0;

  function playerName(index: number): string {
    return table.players[index]?.name ?? seatNames[index] ?? `Player ${index + 1}`;
  }

  function roundLabel(record: RoundRecord): string {
    return `${windNames[record.roundWind]} ${record.handNumber}`;
  }

  function roundIdLabel(roundId: string): string {
    const record = table.history.find((item) => item.id === roundId);
    return record === undefined ? "a later round" : roundLabel(record);
  }

  function toggleTenpai(index: number) {
    setTenpai((current) => toggle(current, index));
  }

  function closeEditor() {
    setEditingRoundId(null);
    setPendingCommand(null);
    setPendingReview(null);
    setEditError(null);
  }

  function openEditor(record: RoundRecord) {
    setEditingRoundId(record.id);
    setPendingCommand(null);
    setPendingReview(null);
    setEditError(null);
    setEditStatus(null);
    setDraftRiichi(handRiichiPlayerIndices(sessionState, record.id));
    if (record.kind === "draw") {
      setDraftTenpai(record.tenpaiPlayerIndices);
    } else {
      setDraftWinner(record.winnerIndex);
      setDraftDiscarder(record.discarderIndex);
    }
  }

  function runPreview(command: SessionEditCommand) {
    const result = session.previewEdit(command);
    if (result.kind === "rejected") {
      setEditError(result.error);
      setPendingCommand(null);
      setPendingReview(null);
      return;
    }
    setEditError(null);
    setPendingCommand(command);
    setPendingReview(result.review);
  }

  function previewOutcome(record: RoundRecord) {
    if (record.kind === "draw") {
      runPreview({
        kind: "replace-round",
        revision: { kind: "draw", tenpaiPlayerIndices: draftTenpai },
        roundId: record.id,
      });
      return;
    }
    runPreview({
      kind: "replace-round",
      revision: {
        discarderIndex: draftDiscarder,
        kind: "win",
        payments: record.payments,
        winnerIndex: draftWinner,
      },
      roundId: record.id,
    });
  }

  function previewRiichi(record: RoundRecord) {
    runPreview({
      declarations: draftRiichi.map((playerIndex) => ({
        ...createRoundCommandMetadata(),
        playerIndex,
      })),
      kind: "set-hand-riichi",
      roundId: record.id,
    });
  }

  function applyCorrection() {
    if (pendingCommand === null) {
      return;
    }
    const result = session.editRound(pendingCommand);
    closeEditor();
    if (result.kind === "edited") {
      setEditStatus("Round corrected. Scores updated. Undo is available.");
    }
  }

  function keepAsRecorded() {
    setPendingCommand(null);
    setPendingReview(null);
  }

  function selectWinner(index: number) {
    setDraftWinner(index);
    setDraftDiscarder((current) => (current === index ? null : current));
  }

  function describeChangedRound(change: RoundContextChange): string {
    const identity = `${windNames[change.before.roundWind]} ${change.before.handNumber}`;
    const target = `${windNames[change.after.roundWind]} ${change.after.handNumber}`;
    if (change.before.honba !== change.after.honba) {
      return `${identity} now replays as ${target} · honba ${change.before.honba} → ${change.after.honba}`;
    }
    return `${identity} now replays as ${target}`;
  }

  function describeWarning(warning: EditWarning): string {
    if (warning.kind === "stale-honba-payment") {
      return `${roundIdLabel(warning.roundId)}'s payment was entered with ${warning.beforeHonba} honba; it now replays at ${warning.afterHonba} — re-score that round if the bonus should change.`;
    }
    return `${roundIdLabel(warning.roundId)}'s dealer/non-dealer split may be wrong after this change — re-score that round to confirm.`;
  }

  function describeEditError(error: SessionEditError): string {
    switch (error.kind) {
      case "invalid-revision": {
        return error.reason;
      }
      case "riichi-underfunded": {
        return `This change would leave ${playerName(error.playerIndex)} with under 1,000 points at their riichi in a later hand. Remove that riichi declaration first or adjust the correction.`;
      }
      case "round-not-editable": {
        return "This round was recorded before edits were supported and can't be changed.";
      }
      case "round-not-found": {
        return "This round could no longer be found.";
      }
      default: {
        const exhaustive: never = error;
        return exhaustive;
      }
    }
  }

  function copySummary() {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(summaryText).then(() => setCopied(true));
    }
  }

  function signedPoints(value: number): string {
    return value === 0 ? "±0" : `${value > 0 ? "+" : "−"}${points(Math.abs(value))}`;
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
              onPress={() => {
                session.undo();
                setEditStatus(null);
              }}
              variant="paper"
            />
          </View>
          {editStatus === null ? null : (
            <Text accessibilityLiveRegion="polite" style={styles.editStatus}>
              {editStatus}
            </Text>
          )}
          {table.history.length === 0 ? (
            <Text style={styles.muted}>No completed rounds yet.</Text>
          ) : (
            table.history.toReversed().map((record) => {
              const editable = editableIds.has(record.id);
              const editing = editingRoundId === record.id;
              const editName =
                record.kind === "win"
                  ? `Edit ${roundLabel(record)}, ${playerName(record.winnerIndex)} won`
                  : `Edit ${roundLabel(record)} draw`;
              const laterChanges =
                pendingReview === null
                  ? []
                  : pendingReview.changedRounds.filter((change) => change.roundId !== record.id);
              return (
                <View key={record.id} style={styles.historyGroup}>
                  <View style={styles.historyRow}>
                    <View style={styles.historyCopy}>
                      <Text style={styles.historyTitle}>
                        {roundLabel(record)} ·{" "}
                        {record.kind === "win"
                          ? `${playerName(record.winnerIndex)} won`
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
                    {editable ? (
                      <ActionButton
                        label={editing ? "Close editor" : editName}
                        onPress={() => (editing ? closeEditor() : openEditor(record))}
                        variant="paper"
                      />
                    ) : null}
                  </View>
                  {editing ? (
                    <View style={styles.editor}>
                      <Text accessibilityRole="header" style={styles.editorTitle}>
                        Editing {roundLabel(record)}
                      </Text>
                      {record.kind === "draw" ? (
                        <>
                          <Text style={styles.label}>TENPAI PLAYERS</Text>
                          <View style={styles.tenpaiRow}>
                            {table.players.map((player, index) => {
                              const selected = draftTenpai.includes(index);
                              return (
                                <Pressable
                                  accessibilityLabel={`${player.name} tenpai`}
                                  accessibilityRole="checkbox"
                                  accessibilityState={{ checked: selected }}
                                  key={player.id}
                                  onPress={() =>
                                    setDraftTenpai((current) => toggle(current, index))
                                  }
                                  style={[styles.tenpaiChip, selected && styles.selectedChip]}
                                >
                                  <Text
                                    style={[styles.tenpaiText, selected && styles.selectedChipText]}
                                  >
                                    {player.name}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                          <Text style={styles.label}>RIICHI DECLARED THIS HAND</Text>
                          <View style={styles.tenpaiRow}>
                            {table.players.map((player, index) => {
                              const selected = draftRiichi.includes(index);
                              return (
                                <Pressable
                                  accessibilityLabel={`${player.name} riichi`}
                                  accessibilityRole="checkbox"
                                  accessibilityState={{ checked: selected }}
                                  key={player.id}
                                  onPress={() =>
                                    setDraftRiichi((current) => toggle(current, index))
                                  }
                                  style={[styles.tenpaiChip, selected && styles.selectedChip]}
                                >
                                  <Text
                                    style={[styles.tenpaiText, selected && styles.selectedChipText]}
                                  >
                                    {player.name}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                          <View style={styles.editorActions}>
                            <ActionButton
                              label="Apply"
                              onPress={() => previewOutcome(record)}
                              variant="vermilion"
                            />
                            <ActionButton
                              label="Apply riichi change"
                              onPress={() => previewRiichi(record)}
                              variant="paper"
                            />
                            <ActionButton
                              label="Delete this round"
                              onPress={() =>
                                runPreview({ kind: "delete-round", roundId: record.id })
                              }
                              variant="paper"
                            />
                            <ActionButton label="Cancel" onPress={closeEditor} variant="paper" />
                          </View>
                        </>
                      ) : (
                        <>
                          <Text style={styles.label}>WINNER</Text>
                          <View style={styles.tenpaiRow}>
                            {table.players.map((player, index) => {
                              const selected = draftWinner === index;
                              return (
                                <Pressable
                                  accessibilityLabel={`Winner ${player.name}`}
                                  accessibilityRole="radio"
                                  accessibilityState={{ checked: selected }}
                                  key={player.id}
                                  onPress={() => selectWinner(index)}
                                  style={[styles.tenpaiChip, selected && styles.selectedChip]}
                                >
                                  <Text
                                    style={[styles.tenpaiText, selected && styles.selectedChipText]}
                                  >
                                    {player.name}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                          {record.payments.kind === "ron" ? (
                            <>
                              <Text style={styles.label}>DISCARDER</Text>
                              <View style={styles.tenpaiRow}>
                                {table.players.map((player, index) => {
                                  if (index === draftWinner) {
                                    return null;
                                  }
                                  const selected = draftDiscarder === index;
                                  return (
                                    <Pressable
                                      accessibilityLabel={`Discarder ${player.name}`}
                                      accessibilityRole="radio"
                                      accessibilityState={{ checked: selected }}
                                      key={player.id}
                                      onPress={() => setDraftDiscarder(index)}
                                      style={[styles.tenpaiChip, selected && styles.selectedChip]}
                                    >
                                      <Text
                                        style={[
                                          styles.tenpaiText,
                                          selected && styles.selectedChipText,
                                        ]}
                                      >
                                        {player.name}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            </>
                          ) : (
                            <Text style={styles.muted}>
                              Tsumo — the win is self-drawn, so there is no discarder.
                            </Text>
                          )}
                          <Text style={styles.muted}>
                            Reassigning keeps the payment as recorded (
                            {record.deltas
                              .map((delta) =>
                                delta === 0 ? "±0" : `${delta > 0 ? "+" : ""}${points(delta)}`,
                              )
                              .join("  ")}
                            ). To recompute han, fu, and transfers, re-score the hand.
                          </Text>
                          <View style={styles.editorActions}>
                            <ActionButton
                              label="Apply"
                              onPress={() => previewOutcome(record)}
                              variant="vermilion"
                            />
                            <ActionButton
                              label="Re-score this hand"
                              onPress={() =>
                                router.push({
                                  params: { editRound: record.id },
                                  pathname: "/manual",
                                })
                              }
                              variant="paper"
                            />
                            <ActionButton
                              label="Delete this round"
                              onPress={() =>
                                runPreview({ kind: "delete-round", roundId: record.id })
                              }
                              variant="paper"
                            />
                            <ActionButton label="Cancel" onPress={closeEditor} variant="paper" />
                          </View>
                        </>
                      )}
                      {editError !== null && pendingReview === null ? (
                        <Text accessibilityLiveRegion="polite" style={styles.error}>
                          {describeEditError(editError)}
                        </Text>
                      ) : null}
                      {pendingReview !== null ? (
                        <View accessibilityLiveRegion="polite" style={styles.editConfirm}>
                          <Text style={styles.endTitle}>Confirm this correction</Text>
                          <Text style={styles.confirmSubhead}>Final score changes</Text>
                          {pendingReview.scoreChanges.map((change, index) => (
                            <Text key={index} style={styles.confirmScoreLine}>
                              {playerName(index)}: {signedPoints(change)}
                            </Text>
                          ))}
                          {laterChanges.length > 0 ? (
                            <>
                              <Text style={styles.confirmSubhead}>Later rounds that shift</Text>
                              {laterChanges.map((change) => (
                                <Text key={change.roundId} style={styles.muted}>
                                  {describeChangedRound(change)}
                                </Text>
                              ))}
                            </>
                          ) : null}
                          {pendingReview.warnings.map((warning, index) => (
                            <Text key={index} style={styles.confirmWarning}>
                              {describeWarning(warning)}
                            </Text>
                          ))}
                          <View style={styles.endActions}>
                            <ActionButton
                              label="Apply correction"
                              onPress={applyCorrection}
                              variant="vermilion"
                            />
                            <ActionButton
                              label="Keep as recorded"
                              onPress={keepAsRecorded}
                              variant="paper"
                            />
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
          {legacyHistory ? (
            <Text style={styles.muted}>Rounds recorded before this update can't be edited.</Text>
          ) : null}
        </View>

        <View style={styles.panel}>
          <View style={styles.historyHeader}>
            <Text accessibilityRole="header" style={styles.panelTitle}>
              Game summary
            </Text>
            <ActionButton
              label={showSummary ? "Hide summary" : "Show summary"}
              onPress={() => {
                setShowSummary((current) => !current);
                setCopied(false);
              }}
              variant="paper"
            />
          </View>
          {summary === null ? (
            <Text style={styles.muted}>
              Final standings, a win and draw tally, and a copyable round log.
            </Text>
          ) : (
            <>
              {summary.standings.map((entry) => (
                <View key={entry.playerId} style={styles.standingRow}>
                  <Text style={styles.standingRank}>{entry.placement}</Text>
                  <Text style={styles.standingName}>{entry.name}</Text>
                  <Text style={styles.standingScore}>{points(entry.score)}</Text>
                  <Text style={styles.standingNet}>{signedPoints(entry.net)}</Text>
                </View>
              ))}
              <Text
                accessibilityLabel="Shareable game summary"
                selectable
                style={styles.summaryText}
              >
                {summaryText}
              </Text>
              {Platform.OS === "web" ? (
                <View style={styles.primaryAction}>
                  <ActionButton
                    label={copied ? "Copied" : "Copy summary"}
                    onPress={copySummary}
                    variant="paper"
                  />
                </View>
              ) : (
                <Text style={styles.muted}>Select the text above to copy it.</Text>
              )}
            </>
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
  confirmScoreLine: {
    color: color.ink,
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "700",
  },
  confirmSubhead: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: space.x2,
  },
  confirmWarning: {
    color: color.accent,
    fontFamily: "serif",
    fontSize: 13,
    lineHeight: 19,
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
  editConfirm: {
    backgroundColor: "#F6DCD4",
    borderColor: color.accent,
    borderRadius: 12,
    borderWidth: 1,
    gap: space.x2,
    marginTop: space.x3,
    padding: space.x4,
  },
  editStatus: {
    color: color.jade,
    fontFamily: "serif",
    fontSize: 14,
    fontWeight: "700",
  },
  editor: {
    backgroundColor: color.canvas,
    borderColor: color.line,
    borderRadius: 12,
    borderWidth: 1,
    gap: space.x3,
    marginBottom: space.x2,
    marginTop: space.x2,
    padding: space.x4,
  },
  editorActions: { flexDirection: "row", flexWrap: "wrap", gap: space.x3, marginTop: space.x2 },
  editorTitle: { color: color.ink, fontFamily: "serif", fontSize: 17, fontWeight: "800" },
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
  historyCopy: { flex: 1, minWidth: 200 },
  historyGroup: { borderTopColor: color.line, borderTopWidth: 1 },
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
  standingName: { color: color.ink, flex: 1, fontFamily: "serif", fontSize: 16, fontWeight: "700" },
  standingNet: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 12,
    minWidth: 72,
    textAlign: "right",
  },
  standingRank: {
    color: color.accent,
    fontFamily: "serif",
    fontSize: 18,
    fontWeight: "800",
    minWidth: 20,
  },
  standingRow: {
    alignItems: "center",
    borderTopColor: color.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: space.x3,
    paddingVertical: space.x3,
  },
  standingScore: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 18,
    fontWeight: "800",
    minWidth: 84,
    textAlign: "right",
  },
  summaryText: {
    backgroundColor: color.canvas,
    borderColor: color.line,
    borderRadius: 8,
    borderWidth: 1,
    color: color.ink,
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
    padding: space.x3,
  },
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
