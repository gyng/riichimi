import { describe, expect, it } from "vitest";

import type {
  ScoreHandInput,
  ScoreHandResult,
  ScoreSuccess,
  ScoringRules,
  TileId,
  WinContext,
} from "../index";
import { scoreHand } from "./score-hand";

// End-to-end cross-check of scoreHand against canonical worked example hands.
// Unlike the existing yaku tests (which only check yaku *containment*), each case
// here pins the COMPLETE breakdown — the exact yaku set, total han, rounded fu,
// limit, and payment — computed independently from the published riichi rules.
// A mismatch is a real discrepancy to reconcile against the rules.

const standardRules = {
  allowOpenTanyao: true,
  countedLimit: "yonbaiman",
  doubleYakuman: false,
  id: "standard",
  kiriageMangan: false,
  label: "Standard",
  redFives: false,
  revision: "test",
  sourceUrl: "https://www.worldriichi.org/wrc-rules",
} as const satisfies ScoringRules;

const kiriageRules = { ...standardRules, kiriageMangan: true } as const satisfies ScoringRules;

const defaultContext = {
  chankan: false,
  firstTurn: "none",
  honba: 0,
  ippatsu: false,
  lastTile: "none",
  method: "ron",
  riichi: "none",
  riichiSticks: 0,
  rinshan: false,
  roundWind: "east",
  seatWind: "south",
} as const satisfies WinContext;

interface Expected {
  readonly yaku?: readonly string[];
  readonly yakuman?: readonly string[];
  readonly han?: number | null;
  readonly fu?: number;
  readonly doraTotal?: number;
  readonly limit?: string | null;
  readonly ron?: number;
  readonly tsumo?: { readonly fromEachNonDealer: number; readonly fromDealer: number | null };
}

interface WorkedExample {
  readonly name: string;
  readonly tiles: readonly TileId[];
  readonly winningTile: TileId;
  readonly context?: Partial<WinContext>;
  readonly rules?: ScoringRules;
  readonly doraIndicators?: readonly TileId[];
  readonly expected: Expected;
}

function score(example: WorkedExample): ScoreSuccess {
  const input: ScoreHandInput = {
    concealedTiles: example.tiles,
    context: { ...defaultContext, ...example.context },
    doraIndicators: example.doraIndicators ?? [],
    melds: [],
    rules: example.rules ?? standardRules,
    uraDoraIndicators: [],
    winningTile: example.winningTile,
  };
  const result: ScoreHandResult = scoreHand(input);
  if (result.kind !== "success") {
    throw new Error(`Expected success for "${example.name}", received ${result.kind}.`);
  }
  return result;
}

// 4 sets + a pair; a closed hand ready to win by ron on a two-sided wait unless
// noted. Payments are honba-0 so they follow directly from (han, fu).
const EXAMPLES: readonly WorkedExample[] = [
  {
    name: "pinfu + tanyao, closed ron (non-dealer)",
    tiles: ["2m", "3m", "4m", "3p", "4p", "5p", "6p", "7p", "8p", "3s", "4s", "5s", "6s", "6s"],
    winningTile: "2m",
    expected: { yaku: ["pinfu", "tanyao"], han: 2, fu: 30, limit: null, ron: 2000 },
  },
  {
    name: "pinfu + tanyao + tsumo, closed (non-dealer)",
    tiles: ["2m", "3m", "4m", "3p", "4p", "5p", "6p", "7p", "8p", "3s", "4s", "5s", "6s", "6s"],
    winningTile: "2m",
    context: { method: "tsumo" },
    expected: {
      yaku: ["menzen-tsumo", "pinfu", "tanyao"],
      han: 3,
      fu: 20,
      tsumo: { fromDealer: 1300, fromEachNonDealer: 700 },
    },
  },
  {
    name: "riichi + pinfu + iipeikou, closed ron (non-dealer)",
    tiles: ["2m", "3m", "4m", "2m", "3m", "4m", "6p", "7p", "8p", "5s", "6s", "7s", "9m", "9m"],
    winningTile: "7s",
    context: { riichi: "riichi" },
    expected: { yaku: ["iipeikou", "pinfu", "riichi"], han: 3, fu: 30, ron: 3900 },
  },
  {
    name: "tanyao with a closed simple triplet, ron (non-dealer)",
    tiles: ["2m", "2m", "2m", "3m", "4m", "5m", "4p", "5p", "6p", "6s", "7s", "8s", "8s", "8s"],
    winningTile: "6s",
    expected: { yaku: ["tanyao"], han: 1, fu: 40, ron: 1300 },
  },
  {
    name: "double east (round + seat wind), closed ron (dealer)",
    tiles: [
      "east",
      "east",
      "east",
      "2m",
      "3m",
      "4m",
      "4p",
      "5p",
      "6p",
      "6s",
      "7s",
      "8s",
      "5m",
      "5m",
    ],
    winningTile: "2m",
    context: { roundWind: "east", seatWind: "east" },
    expected: { yaku: ["yakuhai-round", "yakuhai-seat"], han: 2, fu: 40, ron: 3900 },
  },
  {
    name: "riichi + chiitoitsu, ron (non-dealer)",
    tiles: ["1m", "1m", "4m", "4m", "7p", "7p", "9p", "9p", "2s", "2s", "5s", "5s", "east", "east"],
    winningTile: "east",
    context: { riichi: "riichi" },
    expected: { yaku: ["chiitoitsu", "riichi"], han: 3, fu: 25, ron: 3200 },
  },
  {
    name: "pinfu + tanyao + sanshoku doujun, closed ron (non-dealer)",
    tiles: ["2m", "3m", "4m", "2p", "3p", "4p", "2s", "3s", "4s", "5p", "6p", "7p", "8m", "8m"],
    winningTile: "2m",
    expected: {
      yaku: ["pinfu", "sanshoku-doujun", "tanyao"],
      han: 4,
      fu: 30,
      limit: null,
      ron: 7700,
    },
  },
  {
    name: "4han30fu becomes mangan under kiriage",
    tiles: ["2m", "3m", "4m", "2p", "3p", "4p", "2s", "3s", "4s", "5p", "6p", "7p", "8m", "8m"],
    winningTile: "2m",
    rules: kiriageRules,
    expected: {
      yaku: ["pinfu", "sanshoku-doujun", "tanyao"],
      han: 4,
      limit: "mangan",
      ron: 8000,
    },
  },
  {
    name: "pinfu + ittsuu, closed ron (non-dealer)",
    tiles: ["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "2p", "3p", "4p", "5s", "5s"],
    winningTile: "4p",
    expected: { yaku: ["ittsuu", "pinfu"], han: 3, fu: 30, ron: 3900 },
  },
  {
    name: "honitsu + dragon yakuhai, closed ron → mangan (non-dealer)",
    tiles: [
      "2m",
      "3m",
      "4m",
      "6m",
      "7m",
      "8m",
      "green",
      "green",
      "green",
      "1m",
      "1m",
      "1m",
      "white",
      "white",
    ],
    winningTile: "2m",
    expected: { yaku: ["honitsu", "yakuhai-green"], han: 4, limit: "mangan", ron: 8000 },
  },
  {
    // Plain chinitsu — deliberately NOT nine gates (only one 9m) and no iipeikou
    // or ittsuu, so chinitsu is the sole yaku.
    name: "closed chinitsu, ron → haneman (non-dealer)",
    tiles: ["1m", "1m", "1m", "2m", "2m", "3m", "4m", "5m", "5m", "6m", "7m", "7m", "8m", "9m"],
    winningTile: "9m",
    expected: { yaku: ["chinitsu"], han: 6, limit: "haneman", ron: 12000 },
  },
  {
    name: "shousangen, closed ron → mangan (non-dealer)",
    tiles: [
      "white",
      "white",
      "white",
      "green",
      "green",
      "green",
      "red",
      "red",
      "2m",
      "3m",
      "4m",
      "5s",
      "6s",
      "7s",
    ],
    winningTile: "2m",
    expected: {
      yaku: ["shousangen", "yakuhai-green", "yakuhai-white"],
      han: 4,
      limit: "mangan",
      ron: 8000,
    },
  },
  {
    name: "riichi + pinfu + tanyao with one dora, closed ron (non-dealer)",
    tiles: ["2m", "3m", "4m", "3p", "4p", "5p", "6p", "7p", "8p", "3s", "4s", "5s", "6s", "6s"],
    winningTile: "2m",
    context: { riichi: "riichi" },
    doraIndicators: ["5p"], // dora is 6p; the hand holds one 6p
    expected: {
      yaku: ["pinfu", "riichi", "tanyao"],
      han: 4,
      fu: 30,
      doraTotal: 1,
      ron: 7700,
    },
  },
  {
    name: "kokushi musou, ron (non-dealer)",
    tiles: [
      "1m",
      "9m",
      "1p",
      "9p",
      "1s",
      "9s",
      "east",
      "south",
      "west",
      "north",
      "white",
      "green",
      "red",
      "red",
    ],
    winningTile: "red",
    expected: { yakuman: ["kokushi-musou"], han: null, ron: 32000 },
  },
  {
    name: "daisangen, closed ron (dealer)",
    tiles: [
      "white",
      "white",
      "white",
      "green",
      "green",
      "green",
      "red",
      "red",
      "red",
      "2m",
      "3m",
      "4m",
      "5s",
      "5s",
    ],
    winningTile: "2m",
    context: { roundWind: "east", seatWind: "east" },
    expected: { yakuman: ["daisangen"], han: null, ron: 48000 },
  },
];

describe("worked example hands (full breakdown cross-check)", () => {
  it.each(EXAMPLES)("$name", (example) => {
    const scored = score(example);
    const { expected } = example;

    // Assemble only the fields this example pins, on both sides, then assert once
    // (lint forbids conditional expect).
    interface Assertion {
      yaku?: readonly string[];
      yakuman?: readonly string[];
      han?: number | null;
      fu?: number | undefined;
      doraTotal?: number;
      limit?: string | null;
      payments?: unknown;
    }
    const wanted: Assertion = {};
    const actual: Assertion = {};

    if (expected.yaku !== undefined) {
      wanted.yaku = [...expected.yaku].toSorted();
      actual.yaku = scored.yaku.map(({ id }) => id).toSorted();
    }
    if (expected.yakuman !== undefined) {
      wanted.yakuman = [...expected.yakuman].toSorted();
      actual.yakuman = scored.yakuman.map(({ id }) => id).toSorted();
    }
    if (expected.han !== undefined) {
      wanted.han = expected.han;
      actual.han = scored.han;
    }
    if (expected.fu !== undefined) {
      wanted.fu = expected.fu;
      actual.fu = scored.fu?.rounded;
    }
    if (expected.doraTotal !== undefined) {
      wanted.doraTotal = expected.doraTotal;
      actual.doraTotal = scored.dora.total;
    }
    if (expected.limit !== undefined) {
      wanted.limit = expected.limit;
      actual.limit = scored.limit;
    }
    if (expected.ron !== undefined) {
      wanted.payments = { fromDiscarder: expected.ron, kind: "ron", total: expected.ron };
      actual.payments = scored.payments;
    }
    if (expected.tsumo !== undefined) {
      const { fromDealer, fromEachNonDealer } = expected.tsumo;
      wanted.payments = {
        fromDealer,
        fromEachNonDealer,
        kind: "tsumo",
        total: (fromDealer ?? fromEachNonDealer) + fromEachNonDealer * 2,
      };
      actual.payments = scored.payments;
    }

    expect(actual).toEqual(wanted);
  });
});
