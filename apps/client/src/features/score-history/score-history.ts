import { canonicalTileIds, redFiveIds } from "@richii/score-core";
import type {
  PaymentBreakdown,
  ScoreHandInput,
  ScoreSuccess,
  TileId,
  WinMethod,
  Wind,
  Yaku,
  Yakuman,
} from "@richii/score-core";

export interface ScoreHistoryEntry {
  readonly calculatedAt: string;
  readonly context: {
    readonly honba: number;
    readonly method: WinMethod;
    readonly riichiSticks: number;
    readonly roundWind: Wind;
    readonly seatWind: Wind;
  };
  readonly fingerprint: string;
  readonly hand: {
    readonly concealedTiles: readonly TileId[];
    readonly doraCount: number;
    readonly meldCount: number;
    readonly winningTile: TileId;
  };
  readonly id: string;
  readonly result: {
    readonly fu: number | null;
    readonly han: number | null;
    readonly limit: string | null;
    readonly payments: PaymentBreakdown;
    readonly totalGain: number;
    readonly yaku: readonly Pick<Yaku, "han" | "id" | "name" | "romanized">[];
    readonly yakuman: readonly Pick<Yakuman, "id" | "name" | "romanized" | "value">[];
  };
  readonly rules: {
    readonly id: string;
    readonly label: string;
  };
}

export interface ScoreHistoryState {
  readonly entries: readonly ScoreHistoryEntry[];
  readonly version: 1;
}

export const emptyScoreHistory: ScoreHistoryState = { entries: [], version: 1 };

const tileIds = new Set<string>([...canonicalTileIds, ...redFiveIds]);
const winds = new Set<string>(["east", "south", "west", "north"]);
const methods = new Set<string>(["ron", "tsumo"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isTile(value: unknown): value is TileId {
  return typeof value === "string" && tileIds.has(value);
}

function isPayments(value: unknown): value is PaymentBreakdown {
  if (!isRecord(value) || !isFiniteNumber(value["total"])) {
    return false;
  }
  if (value["kind"] === "ron") {
    return isFiniteNumber(value["fromDiscarder"]);
  }
  return (
    value["kind"] === "tsumo" &&
    isNullableNumber(value["fromDealer"]) &&
    isFiniteNumber(value["fromEachNonDealer"])
  );
}

function isNamedValue(value: unknown, valueKey: "han" | "value"): boolean {
  return (
    isRecord(value) &&
    typeof value["id"] === "string" &&
    typeof value["name"] === "string" &&
    typeof value["romanized"] === "string" &&
    isFiniteNumber(value[valueKey])
  );
}

function isEntry(value: unknown): value is ScoreHistoryEntry {
  if (
    !isRecord(value) ||
    typeof value["id"] !== "string" ||
    typeof value["calculatedAt"] !== "string" ||
    typeof value["fingerprint"] !== "string"
  ) {
    return false;
  }
  const context = value["context"];
  const hand = value["hand"];
  const result = value["result"];
  const rules = value["rules"];
  return (
    isRecord(context) &&
    methods.has(String(context["method"])) &&
    winds.has(String(context["roundWind"])) &&
    winds.has(String(context["seatWind"])) &&
    isFiniteNumber(context["honba"]) &&
    isFiniteNumber(context["riichiSticks"]) &&
    isRecord(hand) &&
    Array.isArray(hand["concealedTiles"]) &&
    hand["concealedTiles"].every(isTile) &&
    isTile(hand["winningTile"]) &&
    isFiniteNumber(hand["doraCount"]) &&
    isFiniteNumber(hand["meldCount"]) &&
    isRecord(result) &&
    isNullableNumber(result["fu"]) &&
    isNullableNumber(result["han"]) &&
    (result["limit"] === null || typeof result["limit"] === "string") &&
    isPayments(result["payments"]) &&
    isFiniteNumber(result["totalGain"]) &&
    Array.isArray(result["yaku"]) &&
    result["yaku"].every((item) => isNamedValue(item, "han")) &&
    Array.isArray(result["yakuman"]) &&
    result["yakuman"].every((item) => isNamedValue(item, "value")) &&
    isRecord(rules) &&
    typeof rules["id"] === "string" &&
    typeof rules["label"] === "string"
  );
}

export function createScoreHistoryEntry(input: {
  readonly calculatedAt: string;
  readonly hand: ScoreHandInput;
  readonly id: string;
  readonly result: ScoreSuccess;
}): ScoreHistoryEntry {
  const fingerprint = JSON.stringify({
    concealedTiles: input.hand.concealedTiles,
    context: input.hand.context,
    doraIndicators: input.hand.doraIndicators,
    melds: input.hand.melds,
    rulesId: input.hand.rules.id,
    uraDoraIndicators: input.hand.uraDoraIndicators,
    winningTile: input.hand.winningTile,
  });
  return {
    calculatedAt: input.calculatedAt,
    context: {
      honba: input.hand.context.honba,
      method: input.hand.context.method,
      riichiSticks: input.hand.context.riichiSticks,
      roundWind: input.hand.context.roundWind,
      seatWind: input.hand.context.seatWind,
    },
    fingerprint,
    hand: {
      concealedTiles: input.hand.concealedTiles,
      doraCount: input.hand.doraIndicators.length,
      meldCount: input.hand.melds.length,
      winningTile: input.hand.winningTile,
    },
    id: input.id,
    result: {
      fu: input.result.fu?.rounded ?? null,
      han: input.result.han,
      limit: input.result.limit,
      payments: input.result.payments,
      totalGain: input.result.totalGain,
      yaku: input.result.yaku.map(({ han, id, name, romanized }) => ({ han, id, name, romanized })),
      yakuman: input.result.yakuman.map(({ id, name, romanized, value }) => ({
        id,
        name,
        romanized,
        value,
      })),
    },
    rules: { id: input.hand.rules.id, label: input.hand.rules.label },
  };
}

export function addScoreHistoryEntry(
  state: ScoreHistoryState,
  entry: ScoreHistoryEntry,
  maximumEntries = 20,
): ScoreHistoryState {
  const previous = state.entries.filter(({ fingerprint }) => fingerprint !== entry.fingerprint);
  return { entries: [entry, ...previous].slice(0, maximumEntries), version: 1 };
}

export function removeScoreHistoryEntry(
  state: ScoreHistoryState,
  entryId: string,
): ScoreHistoryState {
  return { entries: state.entries.filter(({ id }) => id !== entryId), version: 1 };
}

export function parseScoreHistory(serialized: string): ScoreHistoryState {
  const parsed: unknown = JSON.parse(serialized);
  const entries = isRecord(parsed) ? parsed["entries"] : undefined;
  if (
    !isRecord(parsed) ||
    parsed["version"] !== 1 ||
    !Array.isArray(entries) ||
    !entries.every(isEntry)
  ) {
    throw new Error("Saved score history has an unsupported format.");
  }
  return { entries, version: 1 };
}
