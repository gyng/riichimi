import { describe, expect, it } from "vitest";

import type { ScoringRules, WinContext } from "../index";
import { calculateBasePoints, calculatePayments } from "./payments";

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
} as const satisfies WinContext;

describe("calculateBasePoints", () => {
  it.each([
    { expected: { basePoints: 240, limit: null }, fu: 30, han: 1 },
    { expected: { basePoints: 2000, limit: "mangan" }, fu: 60, han: 3 },
    { expected: { basePoints: 2000, limit: "mangan" }, fu: 30, han: 4 },
    { expected: { basePoints: 2000, limit: "mangan" }, fu: 20, han: 5 },
    { expected: { basePoints: 3000, limit: "haneman" }, fu: 20, han: 6 },
    { expected: { basePoints: 4000, limit: "baiman" }, fu: 20, han: 8 },
    { expected: { basePoints: 6000, limit: "sanbaiman" }, fu: 20, han: 11 },
    { expected: { basePoints: 8000, limit: "yonbaiman" }, fu: 20, han: 13 },
  ])("maps $han han $fu fu to its WRC base value", ({ expected, fu, han }) => {
    expect(calculateBasePoints(han, fu, 0, rules)).toEqual(expected);
  });

  it.each([
    { count: 1, limit: "yakuman" },
    { count: 2, limit: "double yakuman" },
    { count: 3, limit: "triple yakuman" },
    { count: 4, limit: "quadruple yakuman" },
    { count: 5, limit: "5x yakuman" },
  ])("stacks $count yakuman", ({ count, limit }) => {
    expect(calculateBasePoints(0, 0, count, rules)).toEqual({
      basePoints: count * 8000,
      limit,
    });
  });

  it("does not apply kiriage when a profile disables it", () => {
    expect(calculateBasePoints(4, 30, 0, { ...rules, kiriageMangan: false })).toEqual({
      basePoints: 1920,
      limit: null,
    });
  });
});

describe("calculatePayments", () => {
  it("rounds a non-dealer ron payment up to the next hundred", () => {
    expect(calculatePayments(240, context)).toEqual({
      fromDiscarder: 1000,
      kind: "ron",
      total: 1000,
    });
  });

  it("charges six times base value when East wins by ron", () => {
    expect(calculatePayments(2000, { ...context, seatWind: "east" })).toEqual({
      fromDiscarder: 12000,
      kind: "ron",
      total: 12000,
    });
  });

  it("adds three hundred points per honba to ron", () => {
    expect(calculatePayments(2000, { ...context, honba: 2 })).toEqual({
      fromDiscarder: 8600,
      kind: "ron",
      total: 8600,
    });
  });

  it("splits a non-dealer tsumo between East and the other players", () => {
    expect(calculatePayments(2000, { ...context, honba: 1, method: "tsumo" })).toEqual({
      fromDealer: 4100,
      fromEachNonDealer: 2100,
      kind: "tsumo",
      total: 8300,
    });
  });

  it("charges each non-dealer equally when East wins by tsumo", () => {
    expect(
      calculatePayments(2000, { ...context, honba: 1, method: "tsumo", seatWind: "east" }),
    ).toEqual({
      fromDealer: null,
      fromEachNonDealer: 4100,
      kind: "tsumo",
      total: 12300,
    });
  });
});
