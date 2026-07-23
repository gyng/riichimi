import { describe, expect, it } from "vitest";

import type {
  DeclaredMeld,
  ScoreHandInput,
  ScoreHandResult,
  ScoreSuccess,
  ScoringRules,
  TileId,
  WinContext,
} from "../index";
import { scoreHand } from "./score-hand";

// Cross-check scoreHand on the two hardest classes for a scorer:
//   - open / called-meld hands (open-han reductions, open-triplet fu, no menzen
//     bonus, kuipinfu 30fu), and
//   - ambiguous hands where one tile set decomposes multiple ways and the engine
//     must pick the highest-scoring reading.
// Each case pins the complete breakdown, computed independently from the rules.

const standardRules = {
  allowOpenTanyao: true,
  countedLimit: "yonbaiman",
  doubleYakuman: false,
  doubleWindPairFu: 2,
  maxYakumanMultiple: null,
  uraDora: true,
  yakumanStacking: "additive",
  id: "standard",
  kiriageMangan: false,
  label: "Standard",
  redFives: false,
  revision: "test",
  sourceUrl: "https://www.worldriichi.org/wrc-rules",
} as const satisfies ScoringRules;

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
  readonly fu?: number | undefined;
  readonly limit?: string | null;
  readonly ron?: number;
  readonly tsumo?: { readonly fromEachNonDealer: number; readonly fromDealer: number | null };
}

interface Example {
  readonly name: string;
  readonly tiles: readonly TileId[];
  readonly winningTile: TileId;
  readonly melds?: readonly DeclaredMeld[];
  readonly context?: Partial<WinContext>;
  readonly expected: Expected;
}

function score(example: Example): ScoreSuccess {
  const input: ScoreHandInput = {
    concealedTiles: example.tiles,
    context: { ...defaultContext, ...example.context },
    doraIndicators: [],
    melds: example.melds ?? [],
    rules: standardRules,
    uraDoraIndicators: [],
    winningTile: example.winningTile,
  };
  const result: ScoreHandResult = scoreHand(input);
  if (result.kind !== "success") {
    throw new Error(`Expected success for "${example.name}", received ${result.kind}.`);
  }
  return result;
}

const OPEN_EXAMPLES: readonly Example[] = [
  {
    // Open all-sequence hand: 20 base fu bumped to 30 (kuipinfu), no menzen bonus,
    // sanshoku reduced to 1 han when open.
    name: "open sanshoku + tanyao, ron (kuipinfu 30fu)",
    tiles: ["2p", "3p", "4p", "2s", "3s", "4s", "5p", "6p", "7p", "8m", "8m"],
    winningTile: "2p",
    melds: [{ kind: "sequence", open: true, tiles: ["2m", "3m", "4m"] }],
    expected: { yaku: ["sanshoku-doujun", "tanyao"], han: 2, fu: 30, ron: 2000 },
  },
  {
    // Open honour triplet: +4 fu (open terminal/honour triplet), no menzen bonus.
    name: "open dragon triplet (yakuhai), ron",
    tiles: ["2m", "3m", "4m", "5p", "6p", "7p", "6s", "7s", "8s", "3s", "3s"],
    winningTile: "2m",
    melds: [{ kind: "triplet", open: true, tile: "white" }],
    expected: { yaku: ["yakuhai-white"], han: 1, fu: 30, ron: 1000 },
  },
  {
    // Open toitoi: two open simple triplets (+2 each), one concealed simple (+4),
    // and the ron-completed honour triplet counts as open (+4).
    name: "open toitoi + yakuhai, ron",
    tiles: ["8s", "8s", "8s", "east", "east", "3m", "3m", "east"],
    winningTile: "east",
    melds: [
      { kind: "triplet", open: true, tile: "2m" },
      { kind: "triplet", open: true, tile: "5p" },
    ],
    context: { roundWind: "east", seatWind: "south" },
    expected: { yaku: ["toitoi", "yakuhai-round"], han: 3, fu: 40, ron: 5200 },
  },
  {
    // Open honitsu reduced to 2 han; a concealed terminal triplet (+8) and a
    // dragon pair (+2) still count.
    name: "open honitsu + dragon yakuhai, ron",
    tiles: ["2m", "3m", "4m", "6m", "7m", "8m", "1m", "1m", "1m", "white", "white"],
    winningTile: "2m",
    melds: [{ kind: "triplet", open: true, tile: "green" }],
    expected: { yaku: ["honitsu", "yakuhai-green"], han: 3, fu: 40, ron: 5200 },
  },
];

const AMBIGUOUS_EXAMPLES: readonly Example[] = [
  {
    // 222m 333m 444m decomposes as three triplets OR three 234m sequences. Tsumo,
    // so the triplets are all concealed: sanankou (3han 40fu, 5200) beats the
    // iipeikou+pinfu+tsumo sequence reading (3han 20fu, 2700). Engine must pick max.
    name: "ambiguous triplets-vs-sequences resolves to sanankou",
    tiles: ["2m", "2m", "2m", "3m", "3m", "3m", "4m", "4m", "4m", "6p", "7p", "8p", "9s", "9s"],
    winningTile: "8p",
    context: { method: "tsumo" },
    expected: {
      yaku: ["menzen-tsumo", "sanankou"],
      han: 3,
      fu: 40,
      tsumo: { fromDealer: 2600, fromEachNonDealer: 1300 },
    },
  },
  {
    // 22m33m44m 66p77p88p 55s is both seven pairs AND ryanpeikou. The standard
    // reading (pinfu + ryanpeikou + tanyao = 5han mangan) beats chiitoitsu+tanyao
    // (3han). Engine must prefer the higher standard interpretation.
    name: "ambiguous chiitoitsu-vs-ryanpeikou resolves to ryanpeikou",
    tiles: ["2m", "2m", "3m", "3m", "4m", "4m", "6p", "6p", "7p", "7p", "8p", "8p", "5s", "5s"],
    winningTile: "2m",
    expected: {
      yaku: ["pinfu", "ryanpeikou", "tanyao"],
      han: 5,
      limit: "mangan",
      ron: 8000,
    },
  },
];

interface Assertion {
  yaku?: readonly string[];
  yakuman?: readonly string[];
  han?: number | null;
  fu?: number | undefined;
  limit?: string | null;
  payments?: unknown;
}

function compare(
  scored: ScoreSuccess,
  expected: Expected,
): { actual: Assertion; wanted: Assertion } {
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

  return { actual, wanted };
}

describe("open / called-meld hands", () => {
  it.each(OPEN_EXAMPLES)("$name", (example) => {
    const { actual, wanted } = compare(score(example), example.expected);
    expect(actual).toEqual(wanted);
  });
});

describe("ambiguous decomposition resolves to the highest score", () => {
  it.each(AMBIGUOUS_EXAMPLES)("$name", (example) => {
    const { actual, wanted } = compare(score(example), example.expected);
    expect(actual).toEqual(wanted);
  });
});
