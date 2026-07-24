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
import { suitedTile } from "../domain/tile";

const rules = {
  allowOpenTanyao: true,
  countedLimit: "yonbaiman",
  doubleWindPairFu: 2,
  doubleYakuman: false,
  id: "wrc-2025-test",
  kiriageMangan: true,
  label: "WRC 2025",
  maxYakumanMultiple: null,
  redFives: false,
  revision: "2025",
  sourceUrl: "https://www.worldriichi.org/wrc-rules",
  uraDora: true,
  yakumanStacking: "additive",
} as const satisfies ScoringRules;

const context = {
  chankan: false,
  firstTurn: "none",
  honba: 0,
  ippatsu: false,
  lastTile: "none",
  method: "ron",
  riichi: "riichi",
  riichiSticks: 0,
  rinshan: false,
  roundWind: "east",
  seatWind: "south",
} as const satisfies WinContext;

function hand(
  concealedTiles: readonly TileId[],
  overrides: Partial<Omit<ScoreHandInput, "concealedTiles" | "rules">> = {},
): ScoreHandInput {
  return {
    concealedTiles,
    context,
    doraIndicators: [],
    melds: [],
    rules,
    uraDoraIndicators: [],
    winningTile: concealedTiles.at(-1) ?? "east",
    ...overrides,
  };
}

function success(result: ScoreHandResult): ScoreSuccess {
  if (result.kind !== "success") {
    throw new Error(`Expected a score, received ${result.kind}.`);
  }
  return result;
}

function fuReasons(result: ScoreSuccess): readonly string[] {
  return result.fu?.items.map(({ reason }) => reason) ?? [];
}

// The shape of the wait decides fu, so each one is a scoring decision rather
// than an implementation detail.
describe("wait shape", () => {
  it("charges fu for a closed wait filling the middle of a run", () => {
    // 4s completes 3s-4s-5s from the inside: kanchan.
    const scored = success(
      scoreHand(
        hand(["2p", "2p", "1m", "2m", "3m", "6m", "7m", "8m", "7p", "8p", "9p", "3s", "5s", "4s"], {
          winningTile: "4s",
        }),
      ),
    );

    expect(fuReasons(scored)).toContain("kanchan wait");
  });

  it("charges fu for the one-sided end of a run", () => {
    // 3m is the only tile that completes 1m-2m: penchan.
    const scored = success(
      scoreHand(
        hand(["2p", "2p", "1m", "2m", "6m", "7m", "8m", "7p", "8p", "9p", "4s", "5s", "6s", "3m"], {
          winningTile: "3m",
        }),
      ),
    );

    expect(fuReasons(scored)).toContain("penchan wait");
  });

  it("charges no wait fu for a two-sided run", () => {
    // 3s completes 4s-5s from the open end: ryanmen, which earns nothing.
    const scored = success(
      scoreHand(
        hand(["2p", "2p", "1m", "2m", "3m", "6m", "7m", "8m", "7p", "8p", "9p", "4s", "5s", "3s"], {
          winningTile: "3s",
        }),
      ),
    );

    expect(fuReasons(scored)).not.toContain("kanchan wait");
    expect(fuReasons(scored)).not.toContain("penchan wait");
  });
});

describe("hands that cannot be scored", () => {
  it("reports tiles that never form a complete hand rather than guessing", () => {
    const result = scoreHand(
      hand(["1m", "3m", "5m", "7m", "9m", "1p", "3p", "5p", "7p", "9p", "1s", "3s", "5s", "7s"]),
    );

    expect(result).toMatchObject({ kind: "not-winning" });
  });

  it("rejects a hand whose tile count cannot fill the remaining sets", () => {
    // Thirteen concealed tiles with no meld can never complete four sets.
    const result = scoreHand(
      hand(["1m", "2m", "3m", "4m", "5m", "6m", "7p", "8p", "9p", "2s", "3s", "4s", "5p"]),
    );

    expect(result.kind).not.toBe("success");
  });
});

describe("suitedTile", () => {
  it("builds a tile for every legal rank", () => {
    expect(suitedTile(1, "m")).toBe("1m");
    expect(suitedTile(9, "s")).toBe("9s");
  });

  it("refuses a rank outside a suit rather than inventing a tile", () => {
    expect(suitedTile(0, "m")).toBeNull();
    expect(suitedTile(10, "p")).toBeNull();
    expect(suitedTile(-1, "s")).toBeNull();
    expect(suitedTile(2.5, "m")).toBeNull();
    expect(suitedTile(Number.NaN, "m")).toBeNull();
  });
});
