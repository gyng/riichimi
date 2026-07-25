import { describe, expect, it } from "vitest";
import type { LimitName, ScoreHandResult } from "@riichimi/score-core";
import { scoreHand } from "@riichimi/score-core";

import { celebrationFor } from "./celebration";

const context = {
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
} as const;

const wrc = {
  allowOpenTanyao: true,
  countedLimit: "yonbaiman",
  doubleWindPairFu: 2,
  doubleYakuman: false,
  id: "wrc",
  kiriageMangan: false,
  label: "WRC",
  maxYakumanMultiple: null,
  redFives: false,
  revision: "t",
  sourceUrl: null,
  uraDora: true,
  yakumanStacking: "additive",
} as const;

// A fully-typed success at a given limit, so the tier table stays readable
// without staging a distinct real hand for every limit name.
const atLimit = (limit: LimitName): ScoreHandResult => ({
  basePoints: 8000,
  dora: { dora: 0, redDora: 0, total: 0, uraDora: 0 },
  fu: null,
  han: null,
  kind: "success",
  limit,
  payments: { fromDiscarder: 8000, kind: "ron", total: 8000 },
  riichiBonus: 0,
  totalGain: 8000,
  yaku: [],
  yakuman: [],
});

describe("celebrationFor", () => {
  it("stays quiet for an ordinary, non-limit hand", () => {
    const ordinary = scoreHand({
      concealedTiles: ["2m", "3m", "4m", "3m", "4m", "5m", "4p", "5p", "6p", "6s", "7s", "8s", "5p", "5p"], // prettier-ignore
      context,
      doraIndicators: [],
      melds: [],
      rules: wrc,
      uraDoraIndicators: [],
      winningTile: "8s",
    });

    expect(ordinary.kind).toBe("success");
    expect(celebrationFor(ordinary)).toBeNull();
  });

  it("escalates the tier from mangan up to a multi-yakuman", () => {
    expect(celebrationFor(atLimit("mangan"))?.tier).toBe(1);
    expect(celebrationFor(atLimit("haneman"))?.tier).toBe(2);
    expect(celebrationFor(atLimit("baiman"))?.tier).toBe(3);
    expect(celebrationFor(atLimit("sanbaiman"))?.tier).toBe(4);
    expect(celebrationFor(atLimit("yonbaiman"))?.tier).toBe(5);
    expect(celebrationFor(atLimit("yakuman"))?.tier).toBe(6);
    expect(celebrationFor(atLimit("double yakuman"))?.tier).toBe(7);
    expect(celebrationFor(atLimit("3x yakuman"))?.tier).toBe(7);
  });

  it("adds lightning only from baiman upward, and lengthens with the tier", () => {
    expect(celebrationFor(atLimit("mangan"))?.lightning).toBe(false);
    expect(celebrationFor(atLimit("haneman"))?.lightning).toBe(false);
    expect(celebrationFor(atLimit("baiman"))?.lightning).toBe(true);

    const mangan = celebrationFor(atLimit("mangan"));
    const yakuman = celebrationFor(atLimit("yakuman"));
    expect(yakuman?.durationMs).toBeGreaterThan(mangan?.durationMs ?? 0);
  });

  it("ignores results that are not a scored win", () => {
    expect(celebrationFor({ kind: "not-winning", message: "x" })).toBeNull();
  });
});
