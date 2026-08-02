import {
  announceWin,
  auditTileInventory,
  canonicalizeTile,
  scoreHand,
  suitedTile,
  tileRank,
  tileSuit,
} from "@riichimi/score-core";
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
} from "@riichimi/score-core";
import { scoringRulesProfile } from "@riichimi/rules";
import { tableBeforeRound } from "@riichimi/session-core";
import type {
  EditReview,
  EditWarning,
  RoundContextChange,
  SessionEditCommand,
  SessionEditError,
} from "@riichimi/session-core";
import {
  ActionButton,
  Checkbox,
  CounterControl,
  MahjongTile,
  SegmentedControl,
  classNames,
  useTileDisplay,
} from "@riichimi/ui";
import { router, useLocalSearchParams } from "../../navigation/router";
import { useEffect, useMemo, useRef, useState, useId } from "react";
import type { ReactNode } from "react";

import { useAnnouncer } from "../../state/announcer-context";
import {
  announcementLead,
  announcementTail,
  announcementText,
} from "../announcer/announcement-text";
import { createRoundCommandMetadata, useSession } from "../../state/session-context";
import { useScoreHistory } from "../../state/score-history-context";
import { useRules } from "../../state/rules-context";
import { useLocale } from "../../state/locale-context";
import { useWebMcpTools, webMcpResult } from "../../infrastructure/webmcp";
import type { RecognitionDraft } from "../recognition/recognition-draft";
import { ScoreDock } from "./score-dock";
import { ScoreResultPanel } from "./score-result-panel";
import { TilePicker } from "./tile-picker";
import { celebrationFor } from "../celebration/celebration";
import type { Celebration } from "../celebration/celebration";
import { CelebrationOverlay } from "../celebration/celebration-overlay";
import { CelebrationBanner } from "../celebration/celebration-banner";
import styles from "./manual-calculator.module.css";

type PickerTarget = "hand" | "chi" | "pon" | "open-kan" | "closed-kan" | "dora" | "ura";
type SpecialEvent = "normal" | "rinshan" | "haitei" | "houtei" | "chankan" | FirstTurnWin;

type Translate = (source: string) => string;

const methodOptionsFor = (t: Translate) =>
  [
    { label: t("Tsumo"), value: "tsumo" },
    { label: t("Ron"), value: "ron" },
  ] as const;

const windOptionsFor = (t: Translate) =>
  [
    { label: t("East"), value: "east" },
    { label: t("South"), value: "south" },
    { label: t("West"), value: "west" },
    { label: t("North"), value: "north" },
  ] as const;

const riichiOptionsFor = (t: Translate) =>
  [
    { label: t("None"), value: "none" },
    { label: t("Riichi"), value: "riichi" },
    { label: t("Double"), value: "double-riichi" },
  ] as const;

const pickerOptionsFor = (t: Translate): readonly { label: string; value: PickerTarget }[] => [
  { label: t("Hand tile"), value: "hand" },
  { label: t("Chi"), value: "chi" },
  { label: t("Pon"), value: "pon" },
  { label: t("Open kan"), value: "open-kan" },
  { label: t("Closed kan"), value: "closed-kan" },
  { label: t("Dora"), value: "dora" },
  { label: t("Ura"), value: "ura" },
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
  t: Translate,
): readonly { label: string; value: SpecialEvent }[] {
  if (method === "tsumo") {
    return [
      { label: t("Normal"), value: "normal" },
      { label: t("After kan"), value: "rinshan" },
      { label: t("Last draw"), value: "haitei" },
      seatWind === "east"
        ? { label: t("Tenhou"), value: "tenhou" }
        : { label: t("Chiihou"), value: "chiihou" },
    ] as const;
  }

  const options: { label: string; value: SpecialEvent }[] = [
    { label: t("Normal"), value: "normal" },
    { label: t("Robbed kan"), value: "chankan" },
    { label: t("Last discard"), value: "houtei" },
  ];
  if (seatWind !== "east") {
    options.push({ label: t("Renhou"), value: "renhou" });
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
  className,
  description,
  title,
}: {
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly description?: string | undefined;
  readonly title: string;
}) {
  return (
    <section className={classNames(styles["section"], className)}>
      <h2 className={styles["sectionTitle"]}>{title}</h2>
      {description === undefined ? null : (
        <p className={styles["sectionDescription"]}>{description}</p>
      )}
      {children}
    </section>
  );
}

export function ManualCalculator({
  recognitionDraft,
  referencePhoto,
}: {
  readonly recognitionDraft?: RecognitionDraft | undefined;
  readonly referencePhoto?: string | undefined;
}) {
  const { t } = useLocale();
  const { tileName } = useTileDisplay();
  // One id per visible field label, so each control can point at the words
  // already on screen instead of repeating them.
  const group = useId();
  const labelIds = {
    winner: `${group}-winner`,
    discarder: `${group}-discarder`,
    method: `${group}-method`,
    seatWind: `${group}-seatWind`,
    roundWind: `${group}-roundWind`,
    riichi: `${group}-riichi`,
    special: `${group}-special`,
  };

  // A landscape phone or a desktop has width to spare and little height, so the
  // hand and the picker sit side by side instead of stacking.
  const methodOptions = methodOptionsFor(t);
  const windOptions = windOptionsFor(t);
  const riichiOptions = riichiOptionsFor(t);
  const pickerOptions = pickerOptionsFor(t);
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
  // A limit hand fires a one-shot celebration overlay; the key remounts it so a
  // second mangan in a row plays again. It never gates the score.
  const [celebration, setCelebration] = useState<{ value: Celebration; key: number } | null>(null);
  const celebrationKey = useRef(0);
  const [sessionWinnerIndex, setSessionWinnerIndex] = useState(0);
  const [discarderIndex, setDiscarderIndex] = useState(1);
  const [editReview, setEditReview] = useState<EditReview | null>(null);
  const [editError, setEditError] = useState<SessionEditError | null>(null);
  const [pendingCommand, setPendingCommand] = useState<SessionEditCommand | null>(null);
  const { announceWins, celebrateWins, speech } = useAnnouncer();
  // The docked answer needs somewhere to send a player who wants the reasoning.
  const audit = useRef<HTMLDivElement>(null);
  // Round context is set once per table, so it stays folded away during a hand.
  const [showContextDetail, setShowContextDetail] = useState(false);
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
    t,
  );
  const activeTable = session.state?.table ?? null;
  const searchParams = useLocalSearchParams();
  const editRoundParam = searchParams["editRound"];
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
  // A table pins its own profile by id; otherwise use the resolved active rules
  // directly. Re-resolving by id would drop house-rules edits, since the "house"
  // id is not a reference profile and falls back to WRC.
  const activeRules = activeTable
    ? scoringRulesProfile(activeTable.rulesProfileId)
    : rulesPreference.activeRules;
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

  // A confirmed scan already carries every input the scorer needs, so it scores
  // on arrival rather than asking for one more tap to say "yes, now do it".
  const scoredDraft = useRef(false);
  useEffect(() => {
    if (
      recognitionDraft === undefined ||
      scoredDraft.current ||
      concealedTiles.length !== concealedCapacity ||
      winningIndex === null ||
      doraIndicators.length === 0
    ) {
      return;
    }
    scoredDraft.current = true;
    calculate();
  });

  /** Take a player from the docked answer to the reasoning behind it. */
  function showAudit() {
    audit.current?.scrollIntoView({
      // A jump is disorienting when the audit is two screens away; a scroll
      // shows how far it was. Reduced motion gets the jump.
      behavior: globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }

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
    const earned = celebrateWins ? celebrationFor(scoreResult) : null;
    let fired = false;
    const fireCelebration = () => {
      if (!fired && earned !== null) {
        fired = true;
        celebrationKey.current += 1;
        setCelebration({ key: celebrationKey.current, value: earned });
      }
    };

    if (scoreResult.kind === "success" && activeTable === null) {
      scoreHistory.record(scoreInput, scoreResult);
    }
    // Announcing is opt-in and never gates the score: the panel is already set.
    if (scoreResult.kind === "success" && announceWins && speech.available) {
      const announcement = announceWin(scoreResult);
      if (earned !== null) {
        // Sync: read the yaku out, then stamp the limit as its climax is spoken.
        speech.speak(announcementLead(announcement), {
          onEnd: () => {
            speech.speak(announcementTail(announcement), { onStart: fireCelebration });
            // Safety net in case the start event never arrives.
            globalThis.setTimeout(fireCelebration, 400);
          },
        });
      } else {
        speech.speak(announcementText(announcement));
      }
    } else {
      fireCelebration();
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
        "Load Riichimi's complete closed pinfu-tsumo example into the visible manual calculator for inspection or scoring.",
      execute: () => {
        loadExample();
        return webMcpResult(
          "Loaded the worked example. Call riichimi.manual.calculate after the UI updates.",
        );
      },
      inputSchema: { additionalProperties: false, properties: {}, type: "object" },
      name: "riichimi.manual.load_example",
      title: "Load scoring example",
    },
    {
      annotations: { readOnlyHint: true },
      description:
        "Inspect the tiles and scoring context currently visible in Riichimi's manual calculator without changing them.",
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
      name: "riichimi.manual.get_state",
      title: "Inspect manual hand",
    },
    {
      description: `Validate and score the hand currently visible in Riichimi's manual calculator under ${activeRules.label}, updating the on-screen audit panel.`,
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
      name: "riichimi.manual.calculate",
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
      name: "riichimi.manual.record_table_result",
      title: "Record scored table result",
    },
  ]);

  return (
    <div className={styles["screen"]}>
      <div className={styles["scroll"]}>
        <div className={styles["content"]}>
          <div className={styles["topBar"]}>
            <h1 className={styles["compactTitle"]}>{t("Score a hand")}</h1>
            <button
              aria-label={t("Scoring rules setup")}
              role="link"
              onClick={() => router.push("/settings")}
              className={styles["rulesChip"]}
            >
              <p className={styles["rulesLabel"]}>{activeRules.label.toUpperCase()}</p>
            </button>
          </div>

          {recognitionDraft === undefined ? null : (
            <div className={styles["recognitionBanner"]}>
              <p className={styles["recognitionBannerKicker"]}>
                {t("OFFLINE RECOGNITION \u00b7 REVIEW REQUIRED")}
              </p>
              <p className={styles["recognitionBannerTitle"]}>
                {recognitionDraft.reviewedCount === 0
                  ? t("Confirm the winning tile and dora.")
                  : `${recognitionDraft.reviewedCount} ${t("corrected \u00b7 check against the photo.")}`}
              </p>
              <p className={styles["recognitionModel"]}>MODEL {recognitionDraft.modelVersion}</p>
            </div>
          )}

          {referencePhoto === undefined ? null : (
            <div className={styles["referencePanel"]}>
              <p className={styles["sessionBannerKicker"]}>
                {t("CAPTURE REFERENCE \u00b7 KEPT ON THIS DEVICE")}
              </p>
              <img
                alt="Captured hand reference"
                className={styles["referenceImage"]}
                src={referencePhoto}
              />
              <p className={styles["referenceNote"]}>{t("Not uploaded.")}</p>
            </div>
          )}

          {activeTable === null ? null : (
            <div className={styles["sessionBanner"]}>
              <div className={styles["sessionBannerCopy"]}>
                <p className={styles["sessionBannerKicker"]}>
                  {editMode ? t("EDITING RECORDED ROUND") : t("ACTIVE TABLE \u00b7 CONTEXT LINKED")}
                </p>
                <p className={styles["sessionBannerTitle"]}>
                  {editMode ? t("Re-score this hand.") : t("Pick the winner.")}
                </p>
              </div>
              <div className={styles["sessionChoice"]}>
                <p id={labelIds.winner} className={styles["fieldLabel"]}>
                  {t("WINNER")}
                </p>
                <SegmentedControl
                  labelledBy={labelIds.winner}
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
              </div>
              {method === "ron" ? (
                <div className={styles["sessionChoice"]}>
                  <p id={labelIds.discarder} className={styles["fieldLabel"]}>
                    {t("DISCARDER")}
                  </p>
                  <SegmentedControl
                    labelledBy={labelIds.discarder}
                    onChange={(value) => {
                      setDiscarderIndex(Number(value));
                      resetResult();
                    }}
                    options={discarderOptions}
                    value={String(discarderIndex)}
                  />
                </div>
              ) : null}
            </div>
          )}

          <div className={styles["columns"]}>
            <Section
              className={styles["column"]}
              description={`${concealedTiles.length}/${concealedCapacity} · ${t("tap to mark the winner")}`}
              title={t("Hand")}
            >
              <div aria-label={t("Concealed hand")} className={styles["handRow"]}>
                {concealedTiles.length === 0 ? (
                  <div className={styles["emptyHand"]}>
                    <p className={styles["empty"]}>{t("Add tiles below.")}</p>
                    <ActionButton
                      label={t("Try a scored example")}
                      onPress={loadExample}
                      variant="paper"
                    />
                  </div>
                ) : (
                  concealedTiles.map((tile, index) => (
                    <div key={`${tile}-${index}`} className={styles["tileWithRemove"]}>
                      <MahjongTile
                        onPress={() => {
                          setWinningIndex(index);
                          resetResult();
                        }}
                        selected={winningIndex === index}
                        tile={tile}
                      />
                      <button
                        aria-label={t("Remove {tile} from hand", { tile: tileName(tile) })}
                        onClick={() => removeConcealed(index)}
                        className={styles["removeButton"]}
                      >
                        <p className={styles["removeText"]}>×</p>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {melds.length === 0 ? null : (
                <div className={styles["meldList"]}>
                  {melds.map((meld, index) => (
                    <div key={`${meld.kind}-${index}`} className={styles["meldCard"]}>
                      <div className={styles["meldHeader"]}>
                        <p className={styles["meldLabel"]}>
                          {meld.open ? "OPEN" : "CLOSED"} {meld.kind.toUpperCase()}
                        </p>
                        <button
                          aria-label={t("Remove this {meld}", { meld: t(meld.kind) })}
                          onClick={() => removeMeld(index)}
                        >
                          <p className={styles["removeLink"]}>{t("Remove")}</p>
                        </button>
                      </div>
                      <div className={styles["meldTiles"]}>
                        {meldTiles(meld).map((tile, tileIndex) => (
                          <MahjongTile key={`${tile}-${tileIndex}`} tile={tile} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className={styles["fieldLabel"]}>{t("DORA INDICATORS")}</p>
              <div className={styles["indicatorRow"]}>
                {doraIndicators.length === 0 ? (
                  <p className={styles["empty"]}>{t("Add at least one dora indicator.")}</p>
                ) : null}
                {doraIndicators.map((tile, index) => (
                  <button
                    aria-label={t("Remove dora indicator {tile}", { tile: tileName(tile) })}
                    key={`${tile}-${index}`}
                    onClick={() => {
                      setDoraIndicators((tiles) =>
                        tiles.filter((_, tileIndex) => tileIndex !== index),
                      );
                      resetResult();
                    }}
                  >
                    <MahjongTile tile={tile} />
                  </button>
                ))}
              </div>
              {riichi === "none" ? null : (
                <>
                  <p className={styles["fieldLabel"]}>{t("URA-DORA INDICATORS")}</p>
                  <div className={styles["indicatorRow"]}>
                    {uraDoraIndicators.length === 0 ? (
                      <p className={styles["empty"]}>{t("Optional")}</p>
                    ) : null}
                    {uraDoraIndicators.map((tile, index) => (
                      <button
                        aria-label={t("Remove ura-dora indicator {tile}", { tile: tileName(tile) })}
                        key={`${tile}-${index}`}
                        onClick={() => {
                          setUraDoraIndicators((tiles) =>
                            tiles.filter((_, tileIndex) => tileIndex !== index),
                          );
                          resetResult();
                        }}
                      >
                        <MahjongTile tile={tile} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Section>

            <Section
              description={pickerTarget === "chi" ? t("Chi: pick the lowest tile.") : undefined}
              className={styles["column"]}
              title={t("Tiles")}
            >
              <div aria-label={t("Tile destination")} className={styles["chipRow"]}>
                {pickerOptions.map((option) => {
                  const selected = pickerTarget === option.value;
                  const closedOnlyDisabled = option.value === "ura" && riichi === "none";
                  return (
                    <button
                      role="radio"
                      disabled={closedOnlyDisabled}
                      key={option.value}
                      onClick={() => setPickerTarget(option.value)}
                      className={classNames(
                        styles["chip"],
                        selected && styles["selectedChip"],
                        closedOnlyDisabled && styles["disabledChip"],
                      )}
                    >
                      <p
                        className={classNames(
                          styles["chipText"],
                          selected && styles["selectedChipText"],
                        )}
                      >
                        {option.label}
                      </p>
                    </button>
                  );
                })}
              </div>
              <TilePicker
                isDisabled={isPickerTileDisabled}
                onSelect={addTile}
                showRedFives={activeRules.redFives}
              />
              {inventory.issues.length === 0 ? null : (
                <p aria-live="polite" className={styles["warning"]}>
                  {t("A tile cannot appear more than four times.")}
                </p>
              )}
            </Section>
          </div>

          <Section title={t("Context")}>
            <div className={styles["contextGrid"]}>
              <div className={styles["field"]}>
                <p id={labelIds.method} className={styles["fieldLabel"]}>
                  {t("WIN METHOD")}
                </p>
                <SegmentedControl
                  labelledBy={labelIds.method}
                  onChange={setWinMethod}
                  options={methodOptions}
                  value={method}
                />
              </div>
            </div>

            <button
              aria-label={t("Round and seat details")}
              aria-expanded={showContextDetail}
              onClick={() => setShowContextDetail((visible) => !visible)}
              className={styles["disclosure"]}
            >
              <p className={styles["disclosureLabel"]}>
                {`${t(windNames[seatWind])} ${t("seat")} · ${t(windNames[roundWind])} ${t("round")} · ${riichi === "none" ? t("no riichi") : t("Riichi")} · ${honba} ${t("honba")}`}
              </p>
              <p className={styles["disclosureChevron"]}>{showContextDetail ? "−" : "+"}</p>
            </button>

            {!showContextDetail ? null : (
              <>
                <div className={styles["contextGrid"]}>
                  <div className={styles["field"]}>
                    <p id={labelIds.seatWind} className={styles["fieldLabel"]}>
                      {t("SEAT WIND")}
                    </p>
                    {contextEditable ? (
                      <SegmentedControl
                        labelledBy={labelIds.seatWind}
                        onChange={setPlayerWind}
                        options={windOptions}
                        value={seatWind}
                      />
                    ) : (
                      <p className={styles["linkedValue"]}>{seatWind.toUpperCase()} · FROM TABLE</p>
                    )}
                  </div>
                  <div className={styles["field"]}>
                    <p id={labelIds.roundWind} className={styles["fieldLabel"]}>
                      {t("ROUND WIND")}
                    </p>
                    {contextEditable ? (
                      <SegmentedControl
                        labelledBy={labelIds.roundWind}
                        onChange={(value) => {
                          setRoundWind(value);
                          resetResult();
                        }}
                        options={windOptions}
                        value={roundWind}
                      />
                    ) : (
                      <p className={styles["linkedValue"]}>
                        {roundWind.toUpperCase()} · FROM TABLE
                      </p>
                    )}
                  </div>
                  <div className={styles["field"]}>
                    <p id={labelIds.riichi} className={styles["fieldLabel"]}>
                      {t("RIICHI")}
                    </p>
                    <SegmentedControl
                      labelledBy={labelIds.riichi}
                      onChange={chooseRiichi}
                      options={riichiOptions}
                      value={riichi}
                    />
                  </div>
                  <div className={styles["field"]}>
                    <p id={labelIds.special} className={styles["fieldLabel"]}>
                      {t("SPECIAL WIN")}
                    </p>
                    <SegmentedControl
                      labelledBy={labelIds.special}
                      onChange={(value) => {
                        setSpecialEvent(value);
                        resetResult();
                      }}
                      options={currentSpecialOptions}
                      value={specialEvent}
                    />
                  </div>
                </div>

                {riichi === "none" ? null : (
                  <Checkbox
                    checked={ippatsu}
                    className={styles["ippatsu"]}
                    label={t("Ippatsu")}
                    onChange={(checked) => {
                      setIppatsu(checked);
                      resetResult();
                    }}
                  />
                )}

                {contextEditable ? (
                  <div className={styles["counterRow"]}>
                    <CounterControl
                      decreaseLabel={t("Decrease {label}", { label: t("Honba") })}
                      increaseLabel={t("Increase {label}", { label: t("Honba") })}
                      label={t("Honba")}
                      maximum={20}
                      onChange={(value) => {
                        setHonba(value);
                        resetResult();
                      }}
                      value={honba}
                    />
                    <CounterControl
                      decreaseLabel={t("Decrease {label}", { label: t("Riichi sticks") })}
                      increaseLabel={t("Increase {label}", { label: t("Riichi sticks") })}
                      label={t("Riichi sticks")}
                      maximum={20}
                      onChange={(value) => {
                        setRiichiSticks(value);
                        resetResult();
                      }}
                      value={riichiSticks}
                    />
                  </div>
                ) : (
                  <p className={styles["linkedSummary"]}>
                    {honba} honba · {riichiSticks} riichi sticks inherited from the active table
                  </p>
                )}
                {!isClosed ? (
                  <p className={styles["note"]}>{t("Open hand: no riichi, ippatsu, ura-dora.")}</p>
                ) : null}
              </>
            )}
          </Section>

          <div ref={audit}>{result === null ? null : <ScoreResultPanel result={result} />}</div>
          {activeTable === null && result?.kind === "success" ? (
            <div className={styles["savedNotice"]}>
              <div className={styles["savedCopy"]}>
                <p className={styles["savedKicker"]}>{t("SAVED LOCALLY")}</p>
                <p className={styles["savedTitle"]}>{t("Saved to your folio.")}</p>
              </div>
              <ActionButton
                label={t("View recent scores")}
                onPress={() => router.push("/history")}
                variant="paper"
              />
            </div>
          ) : null}
          {activeTable !== null && !editMode && result?.kind === "success" ? (
            <div className={styles["recordResult"]}>
              <p className={styles["recordTitle"]}>
                {t("Score checked. Ready to update the table.")}
              </p>
              <ActionButton
                label={t("Record result & advance round")}
                onPress={recordScoredTableResult}
                variant="vermilion"
              />
            </div>
          ) : null}
          {editMode && result?.kind === "success" && editReview === null ? (
            <div className={styles["recordResult"]}>
              <p className={styles["recordTitle"]}>{t("Review before replacing the round.")}</p>
              <ActionButton
                label={t("Save correction")}
                onPress={previewCorrection}
                variant="vermilion"
              />
            </div>
          ) : null}
          {editMode && editError !== null && editReview === null ? (
            <p aria-live="polite" className={styles["warning"]}>
              {describeEditError(editError)}
            </p>
          ) : null}
          {editMode && editReview !== null ? (
            <div aria-live="polite" className={styles["editConfirm"]}>
              <p className={styles["editConfirmTitle"]}>{t("Confirm this correction")}</p>
              <p className={styles["editConfirmSubhead"]}>{t("Final score changes")}</p>
              {editReview.scoreChanges.map((change, index) => (
                <p key={index} className={styles["editConfirmScoreLine"]}>
                  {editPlayerName(index)}: {signedPoints(change)}
                </p>
              ))}
              {(() => {
                // The re-scored round always changes; only surface the DOWNSTREAM
                // rounds whose context shifted (matching the session-screen editor).
                const laterChanges = editReview.changedRounds.filter(
                  (change) => change.roundId !== editRoundId,
                );
                return laterChanges.length > 0 ? (
                  <>
                    <p className={styles["editConfirmSubhead"]}>{t("Later rounds that shift")}</p>
                    {laterChanges.map((change) => (
                      <p key={change.roundId} className={styles["editConfirmNote"]}>
                        {describeChangedRound(change)}
                      </p>
                    ))}
                  </>
                ) : null;
              })()}
              {editReview.warnings.map((warning, index) => (
                <p key={index} className={styles["editConfirmWarning"]}>
                  {describeEditWarning(warning)}
                </p>
              ))}
              <div className={styles["editConfirmActions"]}>
                <ActionButton
                  label={t("Update this round")}
                  onPress={confirmCorrection}
                  variant="vermilion"
                />
                <ActionButton
                  label={t("Keep as recorded")}
                  onPress={cancelCorrection}
                  variant="paper"
                />
              </div>
            </div>
          ) : null}
        </div>
        {celebration === null ? null : (
          <div key={celebration.key} className={styles["celebrationLayer"]}>
            <CelebrationOverlay
              celebration={celebration.value}
              onDone={() => setCelebration(null)}
            />
            <CelebrationBanner celebration={celebration.value} />
          </div>
        )}
      </div>
      <ScoreDock onCalculate={calculate} onShowAudit={showAudit} result={result} />
    </div>
  );
}
