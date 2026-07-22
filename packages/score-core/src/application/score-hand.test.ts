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

const rules = {
  allowOpenTanyao: true,
  countedLimit: "yonbaiman",
  doubleYakuman: false,
  id: "wrc-2025-test",
  kiriageMangan: true,
  label: "WRC 2025",
  redFives: false,
  revision: "2025",
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

function hand(
  concealedTiles: readonly TileId[],
  overrides: Partial<Omit<ScoreHandInput, "concealedTiles" | "rules">> = {},
): ScoreHandInput {
  return {
    concealedTiles,
    context: defaultContext,
    doraIndicators: [],
    melds: [],
    rules,
    uraDoraIndicators: [],
    winningTile: concealedTiles.at(-1) ?? "east",
    ...overrides,
  };
}

function expectSuccess(result: ScoreHandResult): ScoreSuccess {
  expect(result.kind).toBe("success");

  if (result.kind !== "success") {
    throw new Error(`Expected a successful score, received ${result.kind}.`);
  }

  return result;
}

describe("scoreHand", () => {
  it("scores a closed pinfu tsumo with split non-dealer payments", () => {
    const result = scoreHand(
      hand(["1m", "2m", "3m", "4m", "5m", "6m", "7p", "8p", "9p", "2s", "3s", "4s", "5p", "5p"], {
        context: { ...defaultContext, method: "tsumo" },
        winningTile: "4s",
      }),
    );

    const success = expectSuccess(result);

    expect(success.yaku.map(({ id }) => id)).toEqual(["menzen-tsumo", "pinfu"]);
    expect(success.han).toBe(2);
    expect(success.fu?.rounded).toBe(20);
    expect(success.payments).toEqual({
      fromDealer: 700,
      fromEachNonDealer: 400,
      kind: "tsumo",
      total: 1500,
    });
  });

  it("applies WRC kiriage mangan to a four-han thirty-fu hand", () => {
    const result = scoreHand(
      hand(["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "2p", "3p", "4p", "5s", "5s"], {
        context: { ...defaultContext, riichi: "riichi" },
        winningTile: "4p",
      }),
    );

    expect(result).toMatchObject({
      fu: { rounded: 30 },
      han: 4,
      kind: "success",
      limit: "mangan",
      payments: { fromDiscarder: 8000, kind: "ron" },
    });
  });

  it("scores seven pairs at exactly twenty-five fu", () => {
    const result = scoreHand(
      hand(
        ["1m", "1m", "2m", "2m", "3p", "3p", "4p", "4p", "5s", "5s", "6s", "6s", "east", "east"],
        {
          context: { ...defaultContext, riichi: "riichi" },
          winningTile: "east",
        },
      ),
    );

    expect(result).toMatchObject({
      fu: { rounded: 25, unrounded: 25 },
      han: 3,
      kind: "success",
      payments: { fromDiscarder: 3200, kind: "ron" },
    });
  });

  it("counts dora only after the hand has a yaku", () => {
    const result = scoreHand(
      hand(["2m", "3m", "4m", "3p", "4p", "5p", "6s", "7s", "8s", "5p", "5p"], {
        doraIndicators: ["white"],
        melds: [{ kind: "triplet", open: true, tile: "green" }],
        winningTile: "8s",
      }),
    );

    expect(result).toMatchObject({
      dora: { dora: 3, total: 3 },
      han: 4,
      kind: "success",
      limit: "mangan",
      payments: { fromDiscarder: 8000, kind: "ron" },
    });
  });

  it("reports a complete open hand with no yaku", () => {
    const result = scoreHand(
      hand(["2p", "3p", "4p", "4p", "5p", "6p", "6s", "7s", "8s", "5m", "5m"], {
        melds: [{ kind: "sequence", open: true, tiles: ["1m", "2m", "3m"] }],
        winningTile: "8s",
      }),
    );

    expect(result).toEqual({ kind: "no-yaku", message: "The hand is complete but has no yaku." });
  });

  it("scores thirteen orphans as yakuman", () => {
    const result = scoreHand(
      hand(
        [
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
        {
          winningTile: "red",
        },
      ),
    );

    expect(result).toMatchObject({
      han: null,
      kind: "success",
      limit: "yakuman",
      payments: { fromDiscarder: 32000, kind: "ron" },
      yakuman: [{ id: "kokushi-musou" }],
    });
  });

  it("stacks independent WRC yakuman without double-wait upgrades", () => {
    const result = scoreHand(
      hand(
        [
          "white",
          "white",
          "white",
          "green",
          "green",
          "green",
          "red",
          "red",
          "red",
          "east",
          "east",
          "east",
          "south",
          "south",
        ],
        {
          context: {
            ...defaultContext,
            firstTurn: "tenhou",
            method: "tsumo",
            seatWind: "east",
          },
          winningTile: "south",
        },
      ),
    );

    expect(result).toMatchObject({
      han: null,
      kind: "success",
      limit: "quadruple yakuman",
      payments: { fromDealer: null, fromEachNonDealer: 64000, kind: "tsumo", total: 192000 },
    });

    const success = expectSuccess(result);
    expect(success.yakuman.map(({ id }) => id).toSorted()).toEqual([
      "daisangen",
      "suuankou",
      "tenhou",
      "tsuuiisou",
    ]);
  });

  it("awards only two fu for a pair that is both seat and round wind", () => {
    const result = scoreHand(
      hand(
        ["1m", "2m", "3m", "4m", "5m", "6m", "7p", "8p", "9p", "2s", "3s", "4s", "east", "east"],
        {
          context: {
            ...defaultContext,
            riichi: "riichi",
            roundWind: "east",
            seatWind: "east",
          },
          winningTile: "4s",
        },
      ),
    );

    expect(result).toMatchObject({ fu: { rounded: 40, unrounded: 32 }, kind: "success" });
  });

  it("rejects red fives under WRC rules", () => {
    const result = scoreHand(
      hand(["1m", "2m", "3m", "4m", "0m", "6m", "7p", "8p", "9p", "2s", "3s", "4s", "5p", "5p"], {
        winningTile: "4s",
      }),
    );

    expect(result).toMatchObject({
      issues: [{ code: "RED_FIVE_NOT_ALLOWED" }],
      kind: "invalid",
    });
  });

  it("rejects an impossible fifth copy across the hand and dora indicators", () => {
    const result = scoreHand(
      hand(["1m", "1m", "1m", "1m", "2m", "3m", "4m", "7p", "8p", "9p", "2s", "3s", "4s", "5p"], {
        doraIndicators: ["1m"],
        winningTile: "5p",
      }),
    );

    expect(result).toMatchObject({
      issues: [{ code: "IMPOSSIBLE_TILE_COUNT" }],
      kind: "invalid",
    });
  });
});
