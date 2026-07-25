import type { Wind } from "@riichimi/score-core";
import { scoringRulesProfile } from "@riichimi/rules";
import {
  editableRoundIds,
  formatSessionSummaryText,
  handRiichiPlayerIndices,
  summarizeSession,
} from "@riichimi/session-core";
import type {
  EditReview,
  EditWarning,
  RoundContextChange,
  RoundRecord,
  SessionEditCommand,
  SessionEditError,
} from "@riichimi/session-core";
import { ActionButton, classNames } from "@riichimi/ui";
import { router } from "../navigation/router";
import { useState } from "react";

import { createRoundCommandMetadata, useSession } from "../state/session-context";
import { RulesProfileControl } from "../features/rules/rules-profile-control";
import { LoadingIndicator } from "../components/loading-indicator";
import { useLocale } from "../state/locale-context";
import styles from "./session-screen.module.css";

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
  const { t } = useLocale();
  const session = useSession();
  const [names, setNames] = useState(["Player 1", "Player 2", "Player 3", "Player 4"]);
  const [tenpai, setTenpai] = useState<readonly number[]>([]);
  // A win is the common outcome; the draw path stays folded until it happens.
  const [showDraw, setShowDraw] = useState(false);
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
      <div className={styles["centered"]}>
        <LoadingIndicator />
        <p className={styles["muted"]}>{t("Opening the local table…")}</p>
      </div>
    );
  }

  if (session.state === null) {
    return (
      <div className={styles["screen"]}>
        <div className={styles["scroll"]}>
          <div className={styles["content"]}>
            <p className={styles["kicker"]}>{t("LOCAL TABLE SESSION")}</p>
            <h1 className={styles["title"]}>{t("Let the round remember itself.")}</h1>
            <p className={styles["intro"]}>{t("Start at 25,000. Everything carries over.")}</p>
            {/* The rules card is sized as a row item; a column would turn its
              320px width floor into a 320px height. */}
            <div className={styles["rulesRow"]}>
              <RulesProfileControl />
            </div>
            <div className={styles["panel"]}>
              <h2 className={styles["panelTitle"]}>{t("Four players")}</h2>
              <div className={styles["nameGrid"]}>
                {names.map((name, index) => (
                  <div key={index} className={styles["nameField"]}>
                    <p className={styles["label"]}>
                      PLAYER {index + 1} · {seatNames[index]}
                    </p>
                    <input
                      aria-label={t("Player {position} name", { position: index + 1 })}
                      autoCapitalize="words"
                      className={styles["input"]}
                      maxLength={24}
                      onChange={(event) =>
                        setNames((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          ),
                        )
                      }
                      onFocus={(event) => event.currentTarget.select()}
                      value={name}
                    />
                  </div>
                ))}
              </div>
              <div className={styles["primaryAction"]}>
                <ActionButton
                  disabled={names.some((name) => name.trim().length === 0)}
                  label={t("Start East 1")}
                  onPress={() => session.createTable(names)}
                  variant="vermilion"
                />
              </div>
            </div>
            {session.storageError === null ? null : (
              <p className={styles["error"]}>{session.storageError}</p>
            )}
          </div>
        </div>
      </div>
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
    // Absent over plain HTTP and in older browsers, where the summary above is
    // still selectable by hand.
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(summaryText).then(() => setCopied(true));
    }
  }

  function signedPoints(value: number): string {
    return value === 0 ? "±0" : `${value > 0 ? "+" : "−"}${points(Math.abs(value))}`;
  }

  return (
    <div className={styles["screen"]}>
      <div className={styles["scroll"]}>
        <div className={styles["content"]}>
          <div className={styles["topBar"]}>
            <p className={styles["rules"]}>{tableRules.label.toUpperCase()} · PINNED</p>
          </div>
          <h1 className={styles["roundTitle"]}>
            {windNames[table.roundWind]} {table.handNumber}
          </h1>
          <p
            aria-label={
              table.riichiSticks === 1
                ? t("{honba} honba, {sticks} riichi stick", {
                    honba: table.honba,
                    sticks: table.riichiSticks,
                  })
                : t("{honba} honba, {sticks} riichi sticks", {
                    honba: table.honba,
                    sticks: table.riichiSticks,
                  })
            }
            className={styles["roundMeta"]}
          >
            {table.honba} {t("honba")} · {table.riichiSticks} {t("riichi sticks")}
          </p>

          <div className={styles["recordBar"]}>
            <ActionButton
              label={t("Score a hand")}
              onPress={() => router.push("/manual")}
              variant="vermilion"
            />
            <p className={styles["recordHint"]}>{t("Context carries over.")}</p>
          </div>

          <div className={styles["playerGrid"]}>
            {table.players.map((player, index) => {
              const seat = seatNames[(index - table.dealerIndex + 4) % 4];
              const hasDeclared = table.declaredRiichiPlayerIndices.includes(index);
              return (
                <div
                  key={player.id}
                  className={classNames(
                    styles["playerCard"],
                    index === table.dealerIndex && styles["dealerCard"],
                  )}
                >
                  <p className={styles["label"]}>
                    {seat}
                    {index === table.dealerIndex ? ` · ${t("DEALER")}` : ""}
                  </p>
                  <p className={styles["playerName"]}>{player.name}</p>
                  <p className={styles["playerScore"]}>{points(player.score)}</p>
                  {hasDeclared ? (
                    <p className={styles["riichiDeclared"]}>{t("Riichi declared")}</p>
                  ) : (
                    <button
                      aria-label={t("Declare riichi")}
                      disabled={player.score < 1000}
                      onClick={() => session.declarePlayerRiichi(index)}
                      className={classNames(
                        styles["riichiPill"],
                        player.score < 1000 && styles["riichiPillDisabled"],
                      )}
                    >
                      <p className={styles["riichiPillLabel"]}>{t("Riichi")}</p>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            aria-label={t("Exhaustive draw")}
            aria-expanded={showDraw}
            onClick={() => setShowDraw((visible) => !visible)}
            className={styles["disclosure"]}
          >
            <p className={styles["disclosureLabel"]}>{t("Exhaustive draw")}</p>
            <p className={styles["disclosureChevron"]}>{showDraw ? "−" : "+"}</p>
          </button>
          {showDraw ? (
            <div className={styles["panel"]}>
              <p className={styles["muted"]}>{t("Tenpai players. Payments are automatic.")}</p>
              <div className={styles["tenpaiRow"]}>
                {table.players.map((player, index) => {
                  const selected = tenpai.includes(index);
                  return (
                    <button
                      role="checkbox"
                      aria-checked={selected}
                      key={player.id}
                      onClick={() => toggleTenpai(index)}
                      className={classNames(
                        styles["tenpaiChip"],
                        selected && styles["selectedChip"],
                      )}
                    >
                      <p
                        className={classNames(
                          styles["tenpaiText"],
                          selected && styles["selectedChipText"],
                        )}
                      >
                        {player.name}
                      </p>
                    </button>
                  );
                })}
              </div>
              <div className={styles["primaryAction"]}>
                <ActionButton
                  label={t("Record draw & advance")}
                  onPress={() => {
                    session.recordDraw({
                      ...createRoundCommandMetadata(),
                      tenpaiPlayerIndices: tenpai,
                    });
                    setTenpai([]);
                    setShowDraw(false);
                  }}
                  variant="paper"
                />
              </div>
            </div>
          ) : null}

          <div className={styles["panel"]}>
            <div className={styles["historyHeader"]}>
              <h2 className={styles["panelTitle"]}>{t("Round history")}</h2>
              <ActionButton
                disabled={session.state.undoStack.length === 0}
                label={t("Undo last change")}
                onPress={() => {
                  session.undo();
                  setEditStatus(null);
                }}
                variant="paper"
              />
            </div>
            {editStatus === null ? null : (
              <p aria-live="polite" className={styles["editStatus"]}>
                {editStatus}
              </p>
            )}
            {table.history.length === 0 ? (
              <p className={styles["muted"]}>{t("No completed rounds yet.")}</p>
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
                  <div key={record.id} className={styles["historyGroup"]}>
                    <div className={styles["historyRow"]}>
                      <div className={styles["historyCopy"]}>
                        <p className={styles["historyTitle"]}>
                          {roundLabel(record)} ·{" "}
                          {record.kind === "win"
                            ? `${playerName(record.winnerIndex)} won`
                            : t("Exhaustive draw")}
                        </p>
                        <p className={styles["historyMeta"]}>
                          {record.honba} honba · {new Date(record.occurredAt).toLocaleString()}
                        </p>
                      </div>
                      <p className={styles["delta"]}>
                        {record.deltas
                          .map((delta) =>
                            delta === 0 ? "±0" : `${delta > 0 ? "+" : ""}${points(delta)}`,
                          )
                          .join("  ")}
                      </p>
                      {editable ? (
                        <ActionButton
                          label={editing ? "Close editor" : editName}
                          onPress={() => (editing ? closeEditor() : openEditor(record))}
                          variant="paper"
                        />
                      ) : null}
                    </div>
                    {editing ? (
                      <div className={styles["editor"]}>
                        <h2 className={styles["editorTitle"]}>Editing {roundLabel(record)}</h2>
                        {record.kind === "draw" ? (
                          <>
                            <p className={styles["label"]}>{t("TENPAI PLAYERS")}</p>
                            <div className={styles["tenpaiRow"]}>
                              {table.players.map((player, index) => {
                                const selected = draftTenpai.includes(index);
                                return (
                                  <button
                                    aria-label={t("{player} is tenpai", { player: player.name })}
                                    role="checkbox"
                                    aria-checked={selected}
                                    key={player.id}
                                    onClick={() =>
                                      setDraftTenpai((current) => toggle(current, index))
                                    }
                                    className={classNames(
                                      styles["tenpaiChip"],
                                      selected && styles["selectedChip"],
                                    )}
                                  >
                                    <p
                                      className={classNames(
                                        styles["tenpaiText"],
                                        selected && styles["selectedChipText"],
                                      )}
                                    >
                                      {player.name}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                            <p className={styles["label"]}>{t("RIICHI DECLARED THIS HAND")}</p>
                            <div className={styles["tenpaiRow"]}>
                              {table.players.map((player, index) => {
                                const selected = draftRiichi.includes(index);
                                return (
                                  <button
                                    aria-label={t("{player} declared riichi", {
                                      player: player.name,
                                    })}
                                    role="checkbox"
                                    aria-checked={selected}
                                    key={player.id}
                                    onClick={() =>
                                      setDraftRiichi((current) => toggle(current, index))
                                    }
                                    className={classNames(
                                      styles["tenpaiChip"],
                                      selected && styles["selectedChip"],
                                    )}
                                  >
                                    <p
                                      className={classNames(
                                        styles["tenpaiText"],
                                        selected && styles["selectedChipText"],
                                      )}
                                    >
                                      {player.name}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                            <div className={styles["editorActions"]}>
                              <ActionButton
                                label={t("Apply")}
                                onPress={() => previewOutcome(record)}
                                variant="vermilion"
                              />
                              <ActionButton
                                label={t("Apply riichi change")}
                                onPress={() => previewRiichi(record)}
                                variant="paper"
                              />
                              <ActionButton
                                label={t("Delete this round")}
                                onPress={() =>
                                  runPreview({ kind: "delete-round", roundId: record.id })
                                }
                                variant="paper"
                              />
                              <ActionButton
                                label={t("Cancel")}
                                onPress={closeEditor}
                                variant="paper"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <p className={styles["label"]}>{t("WINNER")}</p>
                            <div className={styles["tenpaiRow"]}>
                              {table.players.map((player, index) => {
                                const selected = draftWinner === index;
                                return (
                                  <button
                                    aria-label={t("{player} won", { player: player.name })}
                                    role="radio"
                                    aria-checked={selected}
                                    key={player.id}
                                    onClick={() => selectWinner(index)}
                                    className={classNames(
                                      styles["tenpaiChip"],
                                      selected && styles["selectedChip"],
                                    )}
                                  >
                                    <p
                                      className={classNames(
                                        styles["tenpaiText"],
                                        selected && styles["selectedChipText"],
                                      )}
                                    >
                                      {player.name}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                            {record.payments.kind === "ron" ? (
                              <>
                                <p className={styles["label"]}>{t("DISCARDER")}</p>
                                <div className={styles["tenpaiRow"]}>
                                  {table.players.map((player, index) => {
                                    if (index === draftWinner) {
                                      return null;
                                    }
                                    const selected = draftDiscarder === index;
                                    return (
                                      <button
                                        aria-label={t("{player} discarded the winning tile", {
                                          player: player.name,
                                        })}
                                        role="radio"
                                        aria-checked={selected}
                                        key={player.id}
                                        onClick={() => setDraftDiscarder(index)}
                                        className={classNames(
                                          styles["tenpaiChip"],
                                          selected && styles["selectedChip"],
                                        )}
                                      >
                                        <p
                                          className={classNames(
                                            styles["tenpaiText"],
                                            selected && styles["selectedChipText"],
                                          )}
                                        >
                                          {player.name}
                                        </p>
                                      </button>
                                    );
                                  })}
                                </div>
                              </>
                            ) : (
                              <p className={styles["muted"]}>{t("Tsumo \u2014 no discarder.")}</p>
                            )}
                            <p className={styles["muted"]}>
                              {t("Reassigning keeps the payment as recorded.")} ({" "}
                              {record.deltas
                                .map((delta) =>
                                  delta === 0 ? "±0" : `${delta > 0 ? "+" : ""}${points(delta)}`,
                                )
                                .join("  ")}
                              ) {t("To recompute han, fu, and transfers, re-score the hand.")}
                            </p>
                            <div className={styles["editorActions"]}>
                              <ActionButton
                                label={t("Apply")}
                                onPress={() => previewOutcome(record)}
                                variant="vermilion"
                              />
                              <ActionButton
                                label={t("Re-score this hand")}
                                onPress={() =>
                                  router.push({
                                    params: { editRound: record.id },
                                    pathname: "/manual",
                                  })
                                }
                                variant="paper"
                              />
                              <ActionButton
                                label={t("Delete this round")}
                                onPress={() =>
                                  runPreview({ kind: "delete-round", roundId: record.id })
                                }
                                variant="paper"
                              />
                              <ActionButton
                                label={t("Cancel")}
                                onPress={closeEditor}
                                variant="paper"
                              />
                            </div>
                          </>
                        )}
                        {editError !== null && pendingReview === null ? (
                          <p aria-live="polite" className={styles["error"]}>
                            {describeEditError(editError)}
                          </p>
                        ) : null}
                        {pendingReview !== null ? (
                          <div aria-live="polite" className={styles["editConfirm"]}>
                            <p className={styles["endTitle"]}>{t("Confirm this correction")}</p>
                            <p className={styles["confirmSubhead"]}>{t("Final score changes")}</p>
                            {pendingReview.scoreChanges.map((change, index) => (
                              <p key={index} className={styles["confirmScoreLine"]}>
                                {playerName(index)}: {signedPoints(change)}
                              </p>
                            ))}
                            {laterChanges.length > 0 ? (
                              <>
                                <p className={styles["confirmSubhead"]}>
                                  {t("Later rounds that shift")}
                                </p>
                                {laterChanges.map((change) => (
                                  <p key={change.roundId} className={styles["muted"]}>
                                    {describeChangedRound(change)}
                                  </p>
                                ))}
                              </>
                            ) : null}
                            {pendingReview.warnings.map((warning, index) => (
                              <p key={index} className={styles["confirmWarning"]}>
                                {describeWarning(warning)}
                              </p>
                            ))}
                            <div className={styles["endActions"]}>
                              <ActionButton
                                label={t("Apply correction")}
                                onPress={applyCorrection}
                                variant="vermilion"
                              />
                              <ActionButton
                                label={t("Keep as recorded")}
                                onPress={keepAsRecorded}
                                variant="paper"
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
            {legacyHistory ? (
              <p className={styles["muted"]}>{t("Older rounds can't be edited.")}</p>
            ) : null}
          </div>

          <div className={styles["panel"]}>
            <div className={styles["historyHeader"]}>
              <h2 className={styles["panelTitle"]}>{t("Game summary")}</h2>
              <ActionButton
                label={showSummary ? t("Hide summary") : t("Show summary")}
                onPress={() => {
                  setShowSummary((current) => !current);
                  setCopied(false);
                }}
                variant="paper"
              />
            </div>
            {summary === null ? (
              <p className={styles["muted"]}>{t("Standings, tallies, and a copyable log.")}</p>
            ) : (
              <>
                {summary.standings.map((entry) => (
                  <div key={entry.playerId} className={styles["standingRow"]}>
                    <p className={styles["standingRank"]}>{entry.placement}</p>
                    <p className={styles["standingName"]}>{entry.name}</p>
                    <p className={styles["standingScore"]}>{points(entry.score)}</p>
                    <p className={styles["standingNet"]}>{signedPoints(entry.net)}</p>
                  </div>
                ))}
                <p aria-label={t("Shareable game summary")} className={styles["summaryText"]}>
                  {summaryText}
                </p>
                {typeof navigator !== "undefined" && navigator.clipboard ? (
                  <div className={styles["primaryAction"]}>
                    <ActionButton
                      label={copied ? "Copied" : "Copy summary"}
                      onPress={copySummary}
                      variant="paper"
                    />
                  </div>
                ) : (
                  <p className={styles["muted"]}>{t("Select the text above to copy it.")}</p>
                )}
              </>
            )}
          </div>

          {session.storageError === null ? null : (
            <p aria-live="polite" className={styles["error"]}>
              {session.storageError}
            </p>
          )}
          {confirmEnd ? (
            <div className={styles["endConfirm"]}>
              <p className={styles["endTitle"]}>
                {t("End this table and erase its local history?")}
              </p>
              <div className={styles["endActions"]}>
                <ActionButton
                  label={t("Keep table")}
                  onPress={() => setConfirmEnd(false)}
                  variant="paper"
                />
                <ActionButton
                  label={t("End & erase")}
                  onPress={session.clearSession}
                  variant="vermilion"
                />
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmEnd(true)} className={styles["endLink"]}>
              <p className={styles["endLinkText"]}>{t("End this table")}</p>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
