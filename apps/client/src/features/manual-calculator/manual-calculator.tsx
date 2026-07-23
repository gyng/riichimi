import {
  auditTileInventory,
  canonicalizeTile,
  scoreHand,
  suitedTile,
  tileRank,
  tileSuit,
} from "@richii/score-core";
import type {
  DeclaredMeld,
  FirstTurnWin,
  LastTileWin,
  RiichiStatus,
  ScoreHandInput,
  ScoreHandResult,
  TileId,
  Wind,
  WinContext,
  WinMethod,
} from "@richii/score-core";
import { scoringRulesProfile } from "@richii/rules";
import { tableBeforeRound } from "@richii/session-core";
import type {
  EditReview,
  EditWarning,
  RoundContextChange,
  SessionEditCommand,
  SessionEditError,
} from "@richii/session-core";
import {
  ActionButton,
  CounterControl,
  MahjongTile,
  SegmentedControl,
  color,
  space,
  tileAccessibleName,
} from "@richii/ui";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { createRoundCommandMetadata, useSession } from "../../state/session-context";
import { useScoreHistory } from "../../state/score-history-context";
import { useRules } from "../../state/rules-context";
import { useWebMcpTools, webMcpResult } from "../../infrastructure/webmcp";
import type { RecognitionDraft } from "../recognition/recognition-draft";
import { RulesProfileControl } from "../rules/rules-profile-control";
import { ScoreResultPanel } from "./score-result-panel";
import { TilePicker } from "./tile-picker";

type PickerTarget = "hand" | "chi" | "pon" | "open-kan" | "closed-kan" | "dora" | "ura";
type SpecialEvent = "normal" | "rinshan" | "haitei" | "houtei" | "chankan" | FirstTurnWin;

const methodOptions = [
  { label: "Tsumo", value: "tsumo" },
  { label: "Ron", value: "ron" },
] as const;

const windOptions = [
  { label: "East", value: "east" },
  { label: "South", value: "south" },
  { label: "West", value: "west" },
  { label: "North", value: "north" },
] as const;

const riichiOptions = [
  { label: "None", value: "none" },
  { label: "Riichi", value: "riichi" },
  { label: "Double", value: "double-riichi" },
] as const;

const pickerOptions: readonly { label: string; value: PickerTarget }[] = [
  { label: "Hand tile", value: "hand" },
  { label: "Chi", value: "chi" },
  { label: "Pon", value: "pon" },
  { label: "Open kan", value: "open-kan" },
  { label: "Closed kan", value: "closed-kan" },
  { label: "Dora", value: "dora" },
  { label: "Ura", value: "ura" },
];

const seatWinds: readonly Wind[] = ["east", "south", "west", "north"];

const windNames: Record<Wind, string> = {
  east: "East",
  north: "North",
  south: "South",
  west: "West",
};

function signedPoints(value: number): string {
  const magnitude = new Intl.NumberFormat("en-US").format(Math.abs(value));
  return value === 0 ? "±0" : `${value > 0 ? "+" : "−"}${magnitude}`;
}

function describeChangedRound(change: RoundContextChange): string {
  const identity = `${windNames[change.before.roundWind]} ${change.before.handNumber}`;
  const target = `${windNames[change.after.roundWind]} ${change.after.handNumber}`;
  if (change.before.honba !== change.after.honba) {
    return `${identity} now replays as ${target} · honba ${change.before.honba} → ${change.after.honba}`;
  }
  return `${identity} now replays as ${target}`;
}

function describeEditWarning(warning: EditWarning): string {
  if (warning.kind === "stale-honba-payment") {
    return `A later round's payment was entered with ${warning.beforeHonba} honba; it now replays at ${warning.afterHonba} — re-score that round if the bonus should change.`;
  }
  return "A later tsumo's dealer/non-dealer split may be wrong after this change — re-score that round to confirm.";
}

function playerSeatWind(playerIndex: number, dealerIndex: number): Wind {
  return seatWinds[(playerIndex - dealerIndex + 4) % 4] ?? "east";
}

function meldTiles(meld: DeclaredMeld): readonly TileId[] {
  if (meld.kind === "sequence") {
    return meld.tiles;
  }

  return Array.from({ length: meld.kind === "quad" ? 4 : 3 }, () => meld.tile);
}

function specialOptions(
  method: WinMethod,
  seatWind: Wind,
): readonly { label: string; value: SpecialEvent }[] {
  if (method === "tsumo") {
    return [
      { label: "Normal", value: "normal" },
      { label: "After kan", value: "rinshan" },
      { label: "Last draw", value: "haitei" },
      seatWind === "east"
        ? { label: "Tenhou", value: "tenhou" }
        : { label: "Chiihou", value: "chiihou" },
    ] as const;
  }

  const options: { label: string; value: SpecialEvent }[] = [
    { label: "Normal", value: "normal" },
    { label: "Robbed kan", value: "chankan" },
    { label: "Last discard", value: "houtei" },
  ];
  if (seatWind !== "east") {
    options.push({ label: "Renhou", value: "renhou" });
  }
  return options;
}

function contextFromState(input: {
  honba: number;
  ippatsu: boolean;
  method: WinMethod;
  riichi: RiichiStatus;
  riichiSticks: number;
  roundWind: Wind;
  seatWind: Wind;
  specialEvent: SpecialEvent;
}): WinContext {
  const firstTurn: FirstTurnWin =
    input.specialEvent === "tenhou" ||
    input.specialEvent === "chiihou" ||
    input.specialEvent === "renhou"
      ? input.specialEvent
      : "none";
  const lastTile: LastTileWin =
    input.specialEvent === "haitei" || input.specialEvent === "houtei"
      ? input.specialEvent
      : "none";

  return {
    chankan: input.specialEvent === "chankan",
    firstTurn,
    honba: input.honba,
    ippatsu: input.ippatsu,
    lastTile,
    method: input.method,
    riichi: input.riichi,
    riichiSticks: input.riichiSticks,
    rinshan: input.specialEvent === "rinshan",
    roundWind: input.roundWind,
    seatWind: input.seatWind,
  };
}

function Section({
  children,
  description,
  title,
}: {
  readonly children: ReactNode;
  readonly description?: string | undefined;
  readonly title: string;
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {description === undefined ? null : (
        <Text style={styles.sectionDescription}>{description}</Text>
      )}
      {children}
    </View>
  );
}

export function ManualCalculator({
  recognitionDraft,
  referencePhoto,
}: {
  readonly recognitionDraft?: RecognitionDraft | undefined;
  readonly referencePhoto?: string | undefined;
}) {
  const session = useSession();
  const scoreHistory = useScoreHistory();
  const rulesPreference = useRules();
  const [concealedTiles, setConcealedTiles] = useState<readonly TileId[]>(
    recognitionDraft?.concealedTiles ?? [],
  );
  const [melds, setMelds] = useState<readonly DeclaredMeld[]>(recognitionDraft?.melds ?? []);
  const [winningIndex, setWinningIndex] = useState<number | null>(
    recognitionDraft?.winningIndex ?? null,
  );
  const [doraIndicators, setDoraIndicators] = useState<readonly TileId[]>(
    recognitionDraft?.doraIndicators ?? [],
  );
  const [uraDoraIndicators, setUraDoraIndicators] = useState<readonly TileId[]>([]);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>("hand");
  const [method, setMethod] = useState<WinMethod>("tsumo");
  const [seatWind, setSeatWind] = useState<Wind>("south");
  const [roundWind, setRoundWind] = useState<Wind>("east");
  const [riichi, setRiichi] = useState<RiichiStatus>("none");
  const [ippatsu, setIppatsu] = useState(false);
  const [specialEvent, setSpecialEvent] = useState<SpecialEvent>("normal");
  const [honba, setHonba] = useState(0);
  const [riichiSticks, setRiichiSticks] = useState(0);
  const [result, setResult] = useState<ScoreHandResult | null>(null);
  const [sessionWinnerIndex, setSessionWinnerIndex] = useState(0);
  const [discarderIndex, setDiscarderIndex] = useState(1);
  const [editReview, setEditReview] = useState<EditReview | null>(null);
  const [editError, setEditError] = useState<SessionEditError | null>(null);
  const [pendingCommand, setPendingCommand] = useState<SessionEditCommand | null>(null);
  const concealedCapacity = 14 - melds.length * 3;
  const isClosed = melds.every((meld) => meld.kind === "quad" && !meld.open);

  const physicalTiles = useMemo(
    () => [
      ...concealedTiles,
      ...melds.flatMap((meld) => meldTiles(meld)),
      ...doraIndicators,
      ...uraDoraIndicators,
    ],
    [concealedTiles, doraIndicators, melds, uraDoraIndicators],
  );
  const inventory = useMemo(() => auditTileInventory(physicalTiles), [physicalTiles]);
  const currentSpecialOptions: readonly { label: string; value: SpecialEvent }[] = specialOptions(
    method,
    seatWind,
  );
  const activeTable = session.state?.table ?? null;
  const searchParams = useLocalSearchParams<{ editRound?: string }>();
  const editRoundParam = searchParams.editRound;
  const editRoundId =
    typeof editRoundParam === "string" && editRoundParam.length > 0 ? editRoundParam : null;
  const sessionState = session.state;
  // Re-scoring a completed win round. `before` is the replayed table context
  // immediately before that round (NOT the current table), so honba/sticks/wind
  // seed correctly; those fields stay user-editable defaults thereafter.
  const editContext = useMemo(() => {
    if (editRoundId === null || sessionState === null) {
      return null;
    }
    const before = tableBeforeRound(sessionState, editRoundId);
    if (before === null) {
      return null;
    }
    const record = sessionState.table.history.find((item) => item.id === editRoundId);
    if (record === undefined || record.kind !== "win") {
      return null;
    }
    return { before, record } as const;
  }, [editRoundId, sessionState]);
  const editMode = editContext !== null;
  const contextEditable = activeTable === null || editMode;
  const seededEditRoundRef = useRef<string | null>(null);
  const activeRules = scoringRulesProfile(
    activeTable?.rulesProfileId ?? rulesPreference.activeRules.id,
  );
  const playerOptions =
    activeTable?.players.map((player, index) => ({ label: player.name, value: String(index) })) ??
    [];
  const discarderOptions =
    activeTable?.players
      .map((player, index) => ({ label: player.name, value: String(index) }))
      .filter((_, index) => index !== sessionWinnerIndex) ?? [];

  useEffect(() => {
    // In edit mode the context is seeded once from the round being corrected
    // (see below); the live active-table seeding must not clobber it.
    if (activeTable === null || editMode) {
      return;
    }
    const winner = Math.min(sessionWinnerIndex, activeTable.players.length - 1);
    setRoundWind(activeTable.roundWind);
    setHonba(activeTable.honba);
    setRiichiSticks(activeTable.riichiSticks);
    setSeatWind(playerSeatWind(winner, activeTable.dealerIndex));
    setRiichi(activeTable.declaredRiichiPlayerIndices.includes(winner) ? "riichi" : "none");
  }, [activeTable, sessionWinnerIndex, editMode]);

  useEffect(() => {
    if (editContext === null || editRoundId === null) {
      return;
    }
    if (seededEditRoundRef.current === editRoundId) {
      return;
    }
    seededEditRoundRef.current = editRoundId;
    const { before, record } = editContext;
    const winner = record.winnerIndex;
    setSessionWinnerIndex(winner);
    setDiscarderIndex(record.discarderIndex ?? (winner + 1) % 4);
    setMethod(record.payments.kind === "ron" ? "ron" : "tsumo");
    setRoundWind(before.roundWind);
    setHonba(before.honba);
    setRiichiSticks(before.riichiSticks);
    setSeatWind(playerSeatWind(winner, before.dealerIndex));
    setRiichi(before.declaredRiichiPlayerIndices.includes(winner) ? "riichi" : "none");
  }, [editContext, editRoundId]);

  function resetResult() {
    setResult(null);
    setEditReview(null);
    setEditError(null);
    setPendingCommand(null);
  }

  function clearClosedOnlyState() {
    setRiichi("none");
    setIppatsu(false);
    setUraDoraIndicators([]);
  }

  function setWinMethod(nextMethod: WinMethod) {
    setMethod(nextMethod);
    setSpecialEvent("normal");
    resetResult();
  }

  function setPlayerWind(nextWind: Wind) {
    setSeatWind(nextWind);
    setSpecialEvent("normal");
    resetResult();
  }

  function createMeld(tile: TileId): DeclaredMeld | null {
    const canonicalTile = canonicalizeTile(tile);
    if (pickerTarget === "chi") {
      const suit = tileSuit(canonicalTile);
      const rank = tileRank(canonicalTile);
      if (suit === null || rank === null || rank > 7) {
        return null;
      }
      const second = suitedTile(rank + 1, suit);
      const third = suitedTile(rank + 2, suit);
      return second === null || third === null
        ? null
        : { kind: "sequence", open: true, tiles: [canonicalTile, second, third] };
    }
    if (pickerTarget === "pon") {
      return { kind: "triplet", open: true, tile };
    }
    if (pickerTarget === "open-kan") {
      return { kind: "quad", open: true, tile };
    }
    if (pickerTarget === "closed-kan") {
      return { kind: "quad", open: false, tile };
    }
    return null;
  }

  function targetTiles(tile: TileId): readonly TileId[] {
    const meld = createMeld(tile);
    return meld === null ? [tile] : meldTiles(meld);
  }

  function isPickerTileDisabled(tile: TileId): boolean {
    if (pickerTarget === "hand" && concealedTiles.length >= concealedCapacity) {
      return true;
    }
    if (
      pickerTarget !== "hand" &&
      pickerTarget !== "dora" &&
      pickerTarget !== "ura" &&
      melds.length >= 4
    ) {
      return true;
    }
    if (pickerTarget === "ura" && riichi === "none") {
      return true;
    }
    const candidates = targetTiles(tile);
    if (pickerTarget === "chi" && candidates.length !== 3) {
      return true;
    }
    return auditTileInventory([...physicalTiles, ...candidates]).issues.length > 0;
  }

  function addTile(tile: TileId) {
    if (isPickerTileDisabled(tile)) {
      return;
    }
    if (pickerTarget === "hand") {
      setConcealedTiles((tiles) => [...tiles, tile]);
    } else if (pickerTarget === "dora") {
      setDoraIndicators((tiles) => [...tiles, tile]);
    } else if (pickerTarget === "ura") {
      setUraDoraIndicators((tiles) => [...tiles, tile]);
    } else {
      const meld = createMeld(tile);
      if (meld !== null) {
        setMelds((items) => [...items, meld]);
        if (meld.open) {
          clearClosedOnlyState();
        }
      }
    }
    resetResult();
  }

  function removeConcealed(index: number) {
    setConcealedTiles((tiles) => tiles.filter((_, tileIndex) => tileIndex !== index));
    setWinningIndex((current) => {
      if (current === index) {
        return null;
      }
      if (current !== null && current > index) {
        return current - 1;
      }
      return current;
    });
    resetResult();
  }

  function removeMeld(index: number) {
    setMelds((items) => items.filter((_, meldIndex) => meldIndex !== index));
    resetResult();
  }

  function chooseRiichi(nextRiichi: RiichiStatus) {
    setRiichi(nextRiichi);
    if (nextRiichi === "none") {
      setIppatsu(false);
      setUraDoraIndicators([]);
    }
    resetResult();
  }

  function calculate(): ScoreHandResult {
    const winningTile = winningIndex === null ? undefined : concealedTiles[winningIndex];
    if (concealedTiles.length !== concealedCapacity || winningTile === undefined) {
      const invalidResult: ScoreHandResult = {
        issues: [
          {
            code: winningTile === undefined ? "WINNING_TILE_MISSING" : "HAND_SIZE",
            message:
              winningTile === undefined
                ? "Tap one hand tile to mark the winning tile."
                : `Add ${concealedCapacity} concealed tiles for this meld count.`,
          },
        ],
        kind: "invalid",
      };
      setResult(invalidResult);
      return invalidResult;
    }
    if (doraIndicators.length === 0) {
      const invalidResult: ScoreHandResult = {
        issues: [
          {
            code: "INVALID_CONTEXT",
            message: "Add the visible dora indicator before scoring.",
          },
        ],
        kind: "invalid",
      };
      setResult(invalidResult);
      return invalidResult;
    }
    const scoreInput: ScoreHandInput = {
      concealedTiles,
      context: contextFromState({
        honba,
        ippatsu,
        method,
        riichi,
        riichiSticks,
        roundWind,
        seatWind,
        specialEvent,
      }),
      doraIndicators,
      melds,
      rules: activeRules,
      uraDoraIndicators,
      winningTile,
    };
    const scoreResult = scoreHand(scoreInput);
    setResult(scoreResult);
    if (scoreResult.kind === "success" && activeTable === null) {
      scoreHistory.record(scoreInput, scoreResult);
    }
    return scoreResult;
  }

  function loadExample() {
    setConcealedTiles([
      "1m",
      "2m",
      "3m",
      "4m",
      "5m",
      "6m",
      "7p",
      "8p",
      "9p",
      "2s",
      "3s",
      "4s",
      "5p",
      "5p",
    ]);
    setMelds([]);
    setWinningIndex(11);
    setDoraIndicators(["9s"]);
    setUraDoraIndicators([]);
    setMethod("tsumo");
    setSeatWind(
      activeTable === null ? "south" : playerSeatWind(sessionWinnerIndex, activeTable.dealerIndex),
    );
    setRoundWind(activeTable?.roundWind ?? "east");
    setRiichi(
      activeTable?.declaredRiichiPlayerIndices.includes(sessionWinnerIndex) === true
        ? "riichi"
        : "none",
    );
    setIppatsu(false);
    setSpecialEvent("normal");
    setHonba(activeTable?.honba ?? 0);
    setRiichiSticks(activeTable?.riichiSticks ?? 0);
    setPickerTarget("hand");
    setResult(null);
  }

  function recordScoredTableResult() {
    if (activeTable === null) {
      throw new Error("No table is active.");
    }
    if (result?.kind !== "success") {
      throw new Error("Calculate a valid winning hand before recording the table result.");
    }
    const recorded = {
      ...createRoundCommandMetadata(),
      discarderIndex: method === "ron" ? discarderIndex : null,
      payments: result.payments,
      winnerIndex: sessionWinnerIndex,
    };
    session.recordWin(recorded);
    router.replace("/session");
    return recorded;
  }

  function editPlayerName(index: number): string {
    return activeTable?.players[index]?.name ?? `Player ${index + 1}`;
  }

  function describeEditError(error: SessionEditError): string {
    switch (error.kind) {
      case "invalid-revision": {
        return error.reason;
      }
      case "riichi-underfunded": {
        return `This change would leave ${editPlayerName(error.playerIndex)} with under 1,000 points at their riichi in a later hand. Adjust the correction, or remove that riichi first.`;
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

  function previewCorrection() {
    if (editRoundId === null || result?.kind !== "success") {
      return;
    }
    const command: SessionEditCommand = {
      kind: "replace-round",
      revision: {
        discarderIndex: method === "ron" ? discarderIndex : null,
        kind: "win",
        payments: result.payments,
        winnerIndex: sessionWinnerIndex,
      },
      roundId: editRoundId,
    };
    const preview = session.previewEdit(command);
    if (preview.kind === "rejected") {
      setEditError(preview.error);
      setEditReview(null);
      setPendingCommand(null);
      return;
    }
    setEditError(null);
    setEditReview(preview.review);
    setPendingCommand(command);
  }

  function confirmCorrection() {
    if (pendingCommand === null) {
      return;
    }
    const outcome = session.editRound(pendingCommand);
    if (outcome.kind === "edited") {
      router.replace("/session");
      return;
    }
    setEditError(outcome.error);
    setEditReview(null);
    setPendingCommand(null);
  }

  function cancelCorrection() {
    setEditReview(null);
    setPendingCommand(null);
  }

  useWebMcpTools([
    {
      description:
        "Load Richii's complete closed pinfu-tsumo example into the visible manual calculator for inspection or scoring.",
      execute: () => {
        loadExample();
        return webMcpResult(
          "Loaded the worked example. Call richii.manual.calculate after the UI updates.",
        );
      },
      inputSchema: { additionalProperties: false, properties: {}, type: "object" },
      name: "richii.manual.load_example",
      title: "Load scoring example",
    },
    {
      annotations: { readOnlyHint: true },
      description:
        "Inspect the tiles and scoring context currently visible in Richii's manual calculator without changing them.",
      execute: () =>
        webMcpResult("Read the current manual calculator state.", {
          concealedTiles,
          doraIndicators,
          melds,
          result,
          uraDoraIndicators,
          winContext: {
            honba,
            ippatsu,
            method,
            riichi,
            riichiSticks,
            roundWind,
            seatWind,
            specialEvent,
          },
          winningTile: winningIndex === null ? null : (concealedTiles[winningIndex] ?? null),
        }),
      inputSchema: { additionalProperties: false, properties: {}, type: "object" },
      name: "richii.manual.get_state",
      title: "Inspect manual hand",
    },
    {
      description: `Validate and score the hand currently visible in Richii's manual calculator under ${activeRules.label}, updating the on-screen audit panel.`,
      execute: () => {
        const scoreResult = calculate();
        return webMcpResult(
          scoreResult.kind === "success"
            ? "Calculated the maximum-value interpretation and displayed it."
            : "The hand needs correction before it can be scored.",
          scoreResult,
        );
      },
      inputSchema: { additionalProperties: false, properties: {}, type: "object" },
      name: "richii.manual.calculate",
      title: "Calculate current hand",
    },
    {
      description:
        "Record the currently displayed successful score into the active table, apply its transfers, advance or repeat the round, and open the visible session. The action can be undone there.",
      execute: () => {
        const recorded = recordScoredTableResult();
        return webMcpResult("Recorded the scored hand in the active table.", {
          discarderIndex: recorded.discarderIndex,
          payments: recorded.payments,
          winnerIndex: recorded.winnerIndex,
        });
      },
      inputSchema: { additionalProperties: false, properties: {}, type: "object" },
      name: "richii.manual.record_table_result",
      title: "Record scored table result",
    },
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <ActionButton label="Back" onPress={() => router.back()} variant="paper" />
          <Text style={styles.rulesLabel}>{activeRules.label.toUpperCase()}</Text>
        </View>
        <Text style={styles.kicker}>MANUAL SCORE LEDGER</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Build the hand. Audit every point.
        </Text>
        <Text style={styles.intro}>
          Add the complete winning hand, tap its winning tile, then record the table context. The
          calculator checks every legal interpretation and returns the highest-value score.
        </Text>
        <View style={styles.exampleAction}>
          <ActionButton label="Try a scored example" onPress={loadExample} variant="paper" />
        </View>

        {recognitionDraft === undefined ? null : (
          <View style={styles.recognitionBanner}>
            <Text style={styles.recognitionBannerKicker}>
              OFFLINE RECOGNITION · REVIEW REQUIRED
            </Text>
            <Text style={styles.recognitionBannerTitle}>
              {recognitionDraft.reviewedCount === 0
                ? "All 15 reads cleared the beta threshold. Confirm the winning tile and dora before scoring."
                : `${recognitionDraft.reviewedCount} ${recognitionDraft.reviewedCount === 1 ? "uncertain read was" : "uncertain reads were"} confirmed or corrected before continuing. Compare the final hand with the photo once more before scoring.`}
            </Text>
            <Text style={styles.recognitionModel}>MODEL {recognitionDraft.modelVersion}</Text>
          </View>
        )}

        {referencePhoto === undefined ? null : (
          <View style={styles.referencePanel}>
            <Text style={styles.sessionBannerKicker}>CAPTURE REFERENCE · KEPT ON THIS DEVICE</Text>
            <Image
              accessibilityLabel="Captured hand reference"
              resizeMode="contain"
              source={{ uri: referencePhoto }}
              style={styles.referenceImage}
            />
            <Text style={styles.referenceNote}>
              Keep this image open while correcting the tiles below. It is not uploaded.
            </Text>
          </View>
        )}

        <RulesProfileControl lockedProfileId={activeTable?.rulesProfileId} />

        {activeTable === null ? null : (
          <View style={styles.sessionBanner}>
            <View style={styles.sessionBannerCopy}>
              <Text style={styles.sessionBannerKicker}>
                {editMode ? "EDITING RECORDED ROUND" : "ACTIVE TABLE · CONTEXT LINKED"}
              </Text>
              <Text style={styles.sessionBannerTitle}>
                {editMode
                  ? "Re-score this hand. The round's honba, sticks, and winds are seeded but stay editable."
                  : "Choose the winner. Richii will post the transfer and advance the round."}
              </Text>
            </View>
            <View style={styles.sessionChoice}>
              <Text style={styles.fieldLabel}>WINNER</Text>
              <SegmentedControl
                accessibilityLabel="Winning player"
                onChange={(value) => {
                  const index = Number(value);
                  setSessionWinnerIndex(index);
                  if (discarderIndex === index) {
                    setDiscarderIndex((index + 1) % 4);
                  }
                  if (editContext !== null) {
                    setSeatWind(playerSeatWind(index, editContext.before.dealerIndex));
                    setRiichi(
                      editContext.before.declaredRiichiPlayerIndices.includes(index)
                        ? "riichi"
                        : "none",
                    );
                  }
                  resetResult();
                }}
                options={playerOptions}
                value={String(sessionWinnerIndex)}
              />
            </View>
            {method === "ron" ? (
              <View style={styles.sessionChoice}>
                <Text style={styles.fieldLabel}>DISCARDER</Text>
                <SegmentedControl
                  accessibilityLabel="Discarding player"
                  onChange={(value) => {
                    setDiscarderIndex(Number(value));
                    resetResult();
                  }}
                  options={discarderOptions}
                  value={String(discarderIndex)}
                />
              </View>
            ) : null}
          </View>
        )}

        <Section
          description={`${concealedTiles.length} of ${concealedCapacity} concealed tiles · tap a tile to mark the winner`}
          title="1. Winning hand"
        >
          <View accessibilityLabel="Concealed hand" style={styles.handRow}>
            {concealedTiles.length === 0 ? (
              <Text style={styles.empty}>Choose “Hand tile” below, then add your tiles.</Text>
            ) : (
              concealedTiles.map((tile, index) => (
                <View key={`${tile}-${index}`} style={styles.tileWithRemove}>
                  <MahjongTile
                    onPress={() => {
                      setWinningIndex(index);
                      resetResult();
                    }}
                    selected={winningIndex === index}
                    tile={tile}
                  />
                  <Pressable
                    accessibilityLabel={`Remove ${tileAccessibleName(tile)} from hand`}
                    accessibilityRole="button"
                    onPress={() => removeConcealed(index)}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeText}>×</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          {melds.length === 0 ? null : (
            <View style={styles.meldList}>
              {melds.map((meld, index) => (
                <View key={`${meld.kind}-${index}`} style={styles.meldCard}>
                  <View style={styles.meldHeader}>
                    <Text style={styles.meldLabel}>
                      {meld.open ? "OPEN" : "CLOSED"} {meld.kind.toUpperCase()}
                    </Text>
                    <Pressable
                      accessibilityLabel={`Remove ${meld.kind}`}
                      accessibilityRole="button"
                      onPress={() => removeMeld(index)}
                    >
                      <Text style={styles.removeLink}>Remove</Text>
                    </Pressable>
                  </View>
                  <View style={styles.meldTiles}>
                    {meldTiles(meld).map((tile, tileIndex) => (
                      <MahjongTile key={`${tile}-${tileIndex}`} tile={tile} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </Section>

        <Section
          description={
            pickerTarget === "chi" ? "For chi, choose the lowest tile in the sequence." : undefined
          }
          title="2. Add tiles and calls"
        >
          <View accessibilityLabel="Tile destination" style={styles.chipRow}>
            {pickerOptions.map((option) => {
              const selected = pickerTarget === option.value;
              const closedOnlyDisabled = option.value === "ura" && riichi === "none";
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: closedOnlyDisabled }}
                  disabled={closedOnlyDisabled}
                  key={option.value}
                  onPress={() => setPickerTarget(option.value)}
                  style={[
                    styles.chip,
                    selected && styles.selectedChip,
                    closedOnlyDisabled && styles.disabledChip,
                  ]}
                >
                  <Text style={[styles.chipText, selected && styles.selectedChipText]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TilePicker
            isDisabled={isPickerTileDisabled}
            onSelect={addTile}
            showRedFives={activeRules.redFives}
          />
          {inventory.issues.length === 0 ? null : (
            <Text accessibilityLiveRegion="polite" style={styles.warning}>
              A tile cannot appear more than four times.
            </Text>
          )}
        </Section>

        <Section title="3. Indicators">
          <Text style={styles.fieldLabel}>DORA INDICATORS</Text>
          <View style={styles.indicatorRow}>
            {doraIndicators.length === 0 ? (
              <Text style={styles.empty}>Add at least one dora indicator.</Text>
            ) : null}
            {doraIndicators.map((tile, index) => (
              <Pressable
                accessibilityLabel={`Remove dora indicator ${tileAccessibleName(tile)}`}
                accessibilityRole="button"
                key={`${tile}-${index}`}
                onPress={() => {
                  setDoraIndicators((tiles) => tiles.filter((_, tileIndex) => tileIndex !== index));
                  resetResult();
                }}
              >
                <MahjongTile tile={tile} />
              </Pressable>
            ))}
          </View>
          {riichi === "none" ? null : (
            <>
              <Text style={styles.fieldLabel}>URA-DORA INDICATORS</Text>
              <View style={styles.indicatorRow}>
                {uraDoraIndicators.length === 0 ? <Text style={styles.empty}>Optional</Text> : null}
                {uraDoraIndicators.map((tile, index) => (
                  <Pressable
                    accessibilityLabel={`Remove ura-dora indicator ${tileAccessibleName(tile)}`}
                    accessibilityRole="button"
                    key={`${tile}-${index}`}
                    onPress={() => {
                      setUraDoraIndicators((tiles) =>
                        tiles.filter((_, tileIndex) => tileIndex !== index),
                      );
                      resetResult();
                    }}
                  >
                    <MahjongTile tile={tile} />
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </Section>

        <Section title="4. Win context">
          <View style={styles.contextGrid}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>WIN METHOD</Text>
              <SegmentedControl
                accessibilityLabel="Win method"
                onChange={setWinMethod}
                options={methodOptions}
                value={method}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>SEAT WIND</Text>
              {contextEditable ? (
                <SegmentedControl
                  accessibilityLabel="Seat wind"
                  onChange={setPlayerWind}
                  options={windOptions}
                  value={seatWind}
                />
              ) : (
                <Text style={styles.linkedValue}>{seatWind.toUpperCase()} · FROM TABLE</Text>
              )}
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>ROUND WIND</Text>
              {contextEditable ? (
                <SegmentedControl
                  accessibilityLabel="Round wind"
                  onChange={(value) => {
                    setRoundWind(value);
                    resetResult();
                  }}
                  options={windOptions}
                  value={roundWind}
                />
              ) : (
                <Text style={styles.linkedValue}>{roundWind.toUpperCase()} · FROM TABLE</Text>
              )}
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>RIICHI</Text>
              <SegmentedControl
                accessibilityLabel="Riichi declaration"
                onChange={chooseRiichi}
                options={riichiOptions}
                value={riichi}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>SPECIAL WIN</Text>
              <SegmentedControl
                accessibilityLabel="Special win"
                onChange={(value) => {
                  setSpecialEvent(value);
                  resetResult();
                }}
                options={currentSpecialOptions}
                value={specialEvent}
              />
            </View>
          </View>

          {riichi === "none" ? null : (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ippatsu }}
              onPress={() => {
                setIppatsu((value) => !value);
                resetResult();
              }}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, ippatsu && styles.checkedBox]}>
                <Text style={styles.checkmark}>{ippatsu ? "✓" : ""}</Text>
              </View>
              <Text style={styles.checkboxLabel}>Ippatsu</Text>
            </Pressable>
          )}

          {contextEditable ? (
            <View style={styles.counterRow}>
              <CounterControl
                label="Honba"
                maximum={20}
                onChange={(value) => {
                  setHonba(value);
                  resetResult();
                }}
                value={honba}
              />
              <CounterControl
                label="Riichi sticks"
                maximum={20}
                onChange={(value) => {
                  setRiichiSticks(value);
                  resetResult();
                }}
                value={riichiSticks}
              />
            </View>
          ) : (
            <Text style={styles.linkedSummary}>
              {honba} honba · {riichiSticks} riichi sticks inherited from the active table
            </Text>
          )}
          {!isClosed ? (
            <Text style={styles.note}>Open calls disable riichi, ippatsu, and ura-dora.</Text>
          ) : null}
        </Section>

        <View style={styles.calculateRow}>
          <ActionButton label="Calculate maximum score" onPress={calculate} variant="vermilion" />
          <Text style={styles.calculateNote}>
            {activeRules.redFives ? "RED FIVES ENABLED" : "NO RED FIVES"} · KIRIAGE MANGAN
          </Text>
        </View>
        {result === null ? null : <ScoreResultPanel result={result} />}
        {activeTable === null && result?.kind === "success" ? (
          <View style={styles.savedNotice}>
            <View style={styles.savedCopy}>
              <Text style={styles.savedKicker}>SAVED LOCALLY</Text>
              <Text style={styles.savedTitle}>This audit is in your score folio.</Text>
            </View>
            <ActionButton
              label="View recent scores"
              onPress={() => router.push("/history")}
              variant="paper"
            />
          </View>
        ) : null}
        {activeTable !== null && !editMode && result?.kind === "success" ? (
          <View style={styles.recordResult}>
            <Text style={styles.recordTitle}>Score checked. Ready to update the table.</Text>
            <ActionButton
              label="Record result & advance round"
              onPress={recordScoredTableResult}
              variant="vermilion"
            />
          </View>
        ) : null}
        {editMode && result?.kind === "success" && editReview === null ? (
          <View style={styles.recordResult}>
            <Text style={styles.recordTitle}>
              Re-scored this hand. Review the change before it replaces the recorded round.
            </Text>
            <ActionButton label="Save correction" onPress={previewCorrection} variant="vermilion" />
          </View>
        ) : null}
        {editMode && editError !== null && editReview === null ? (
          <Text accessibilityLiveRegion="polite" style={styles.warning}>
            {describeEditError(editError)}
          </Text>
        ) : null}
        {editMode && editReview !== null ? (
          <View accessibilityLiveRegion="polite" style={styles.editConfirm}>
            <Text style={styles.editConfirmTitle}>Confirm this correction</Text>
            <Text style={styles.editConfirmSubhead}>Final score changes</Text>
            {editReview.scoreChanges.map((change, index) => (
              <Text key={index} style={styles.editConfirmScoreLine}>
                {editPlayerName(index)}: {signedPoints(change)}
              </Text>
            ))}
            {(() => {
              // The re-scored round always changes; only surface the DOWNSTREAM
              // rounds whose context shifted (matching the session-screen editor).
              const laterChanges = editReview.changedRounds.filter(
                (change) => change.roundId !== editRoundId,
              );
              return laterChanges.length > 0 ? (
                <>
                  <Text style={styles.editConfirmSubhead}>Later rounds that shift</Text>
                  {laterChanges.map((change) => (
                    <Text key={change.roundId} style={styles.editConfirmNote}>
                      {describeChangedRound(change)}
                    </Text>
                  ))}
                </>
              ) : null;
            })()}
            {editReview.warnings.map((warning, index) => (
              <Text key={index} style={styles.editConfirmWarning}>
                {describeEditWarning(warning)}
              </Text>
            ))}
            <View style={styles.editConfirmActions}>
              <ActionButton
                label="Update this round"
                onPress={confirmCorrection}
                variant="vermilion"
              />
              <ActionButton label="Keep as recorded" onPress={cancelCorrection} variant="paper" />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  calculateNote: {
    color: color.inkMuted,
    flexShrink: 1,
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 0.8,
  },
  calculateRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x4,
    marginBottom: space.x5,
  },
  checkbox: {
    alignItems: "center",
    backgroundColor: color.paper,
    borderColor: color.ink,
    borderRadius: 4,
    borderWidth: 1,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  checkboxLabel: { color: color.ink, fontFamily: "serif", fontSize: 16, fontWeight: "700" },
  checkboxRow: { alignItems: "center", flexDirection: "row", gap: space.x2, marginTop: space.x4 },
  checkedBox: { backgroundColor: color.ink },
  checkmark: { color: color.white, fontSize: 14, fontWeight: "800" },
  chip: {
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: space.x4,
    paddingVertical: 10,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.x2, marginBottom: space.x5 },
  chipText: { color: color.inkMuted, fontFamily: "serif", fontSize: 13, fontWeight: "700" },
  content: {
    alignSelf: "center",
    maxWidth: 1000,
    padding: space.x5,
    paddingBottom: space.x8,
    width: "100%",
  },
  contextGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.x5 },
  counterRow: { flexDirection: "row", flexWrap: "wrap", gap: space.x7, marginTop: space.x5 },
  disabledChip: { opacity: 0.35 },
  editConfirm: {
    backgroundColor: "#F6DCD4",
    borderColor: color.accent,
    borderRadius: 12,
    borderWidth: 1,
    gap: space.x2,
    marginBottom: space.x5,
    marginTop: space.x4,
    padding: space.x4,
  },
  editConfirmActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x3,
    marginTop: space.x3,
  },
  editConfirmNote: { color: color.inkMuted, fontFamily: "serif", fontSize: 13, lineHeight: 19 },
  editConfirmScoreLine: {
    color: color.ink,
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "700",
  },
  editConfirmSubhead: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: space.x2,
  },
  editConfirmTitle: { color: color.ink, fontFamily: "serif", fontSize: 17, fontWeight: "700" },
  editConfirmWarning: {
    color: color.accent,
    fontFamily: "serif",
    fontSize: 13,
    lineHeight: 19,
  },
  empty: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 15,
    fontStyle: "italic",
    paddingVertical: space.x3,
  },
  exampleAction: { alignSelf: "flex-start", marginBottom: space.x7 },
  field: { gap: space.x2, minWidth: 260 },
  fieldLabel: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: space.x2,
    marginTop: space.x4,
  },
  handRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    minHeight: 76,
  },
  indicatorRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    minHeight: 60,
  },
  intro: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 18,
    lineHeight: 28,
    marginBottom: space.x5,
    maxWidth: 720,
  },
  kicker: {
    color: color.accent,
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginTop: space.x7,
  },
  meldCard: {
    backgroundColor: color.canvasDeep,
    borderColor: color.line,
    borderRadius: 10,
    borderWidth: 1,
    padding: space.x3,
  },
  meldHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: space.x2,
  },
  meldLabel: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.9,
  },
  meldList: { flexDirection: "row", flexWrap: "wrap", gap: space.x3, marginTop: space.x4 },
  meldTiles: { flexDirection: "row", gap: 4 },
  note: { color: color.accent, fontFamily: "serif", fontSize: 13, marginTop: space.x4 },
  removeButton: {
    alignItems: "center",
    backgroundColor: color.ink,
    borderRadius: 999,
    height: 20,
    justifyContent: "center",
    position: "absolute",
    right: -5,
    top: -7,
    width: 20,
  },
  removeLink: { color: color.accent, fontFamily: "serif", fontSize: 12, fontWeight: "700" },
  removeText: { color: color.white, fontSize: 15, lineHeight: 17 },
  rulesLabel: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  linkedSummary: {
    color: color.jade,
    fontFamily: "serif",
    fontSize: 15,
    fontWeight: "700",
    marginTop: space.x5,
  },
  linkedValue: {
    color: color.jade,
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "800",
    paddingVertical: space.x3,
  },
  recordResult: {
    alignItems: "center",
    backgroundColor: color.paper,
    borderColor: color.accent,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x4,
    justifyContent: "space-between",
    marginTop: space.x4,
    padding: space.x5,
  },
  recordTitle: {
    color: color.ink,
    flex: 1,
    fontFamily: "serif",
    fontSize: 17,
    fontWeight: "700",
    minWidth: 220,
  },
  referenceImage: {
    aspectRatio: 2.2,
    backgroundColor: color.ink,
    borderRadius: 10,
    marginVertical: space.x3,
    width: "100%",
  },
  referenceNote: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 13,
  },
  referencePanel: {
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: space.x5,
    padding: space.x4,
  },
  savedCopy: { flex: 1, minWidth: 190 },
  savedKicker: {
    color: color.jade,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  savedNotice: {
    alignItems: "center",
    backgroundColor: color.paper,
    borderColor: color.jade,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x4,
    justifyContent: "space-between",
    marginBottom: space.x5,
    padding: space.x4,
  },
  savedTitle: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  recognitionBanner: {
    backgroundColor: "#F2E7D3",
    borderColor: color.accent,
    borderLeftWidth: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: space.x5,
    padding: space.x4,
  },
  recognitionBannerKicker: {
    color: color.accent,
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  recognitionBannerTitle: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 24,
    marginTop: space.x2,
  },
  recognitionModel: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 9,
    letterSpacing: 0.6,
    marginTop: space.x3,
  },
  safeArea: { backgroundColor: color.canvas, flex: 1 },
  section: {
    backgroundColor: color.paper,
    borderColor: color.line,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: space.x5,
    padding: space.x5,
  },
  sectionDescription: {
    color: color.inkMuted,
    fontFamily: "serif",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: space.x4,
  },
  sectionTitle: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginBottom: space.x2,
  },
  sessionBanner: {
    backgroundColor: color.jade,
    borderRadius: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x5,
    marginBottom: space.x5,
    padding: space.x5,
  },
  sessionBannerCopy: {
    flex: 1,
    minWidth: 260,
  },
  sessionBannerKicker: {
    color: "#8FC3AE",
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  sessionBannerTitle: {
    color: color.white,
    fontFamily: "serif",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 25,
    marginTop: space.x2,
  },
  sessionChoice: {
    minWidth: 220,
  },
  selectedChip: { backgroundColor: color.ink, borderColor: color.ink },
  selectedChipText: { color: color.white },
  tileWithRemove: { marginRight: 2, marginTop: space.x2, position: "relative" },
  title: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 47,
    fontWeight: "800",
    letterSpacing: -1.8,
    lineHeight: 50,
    marginBottom: space.x4,
    marginTop: space.x2,
    maxWidth: 700,
  },
  topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  warning: { color: color.accent, fontFamily: "serif", fontSize: 14, marginTop: space.x3 },
});
