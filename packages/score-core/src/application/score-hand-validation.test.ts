import { describe, expect, it } from "vitest";

import type { ScoreHandInput, ScoringRules, WinContext } from "../index";
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

const baseHand = {
  concealedTiles: [
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
  ],
  context,
  doraIndicators: [],
  melds: [],
  rules,
  uraDoraIndicators: [],
  winningTile: "4s",
} as const satisfies ScoreHandInput;

function expectInvalid(input: ScoreHandInput, code: string): void {
  const result = scoreHand(input);
  expect(result.kind).toBe("invalid");

  if (result.kind !== "invalid") {
    throw new Error(`Expected invalid input, received ${result.kind}.`);
  }

  expect(result.issues.map((item) => item.code)).toContain(code);
}

describe("scoreHand validation", () => {
  it("requires fourteen logical tiles", () => {
    expectInvalid({ ...baseHand, concealedTiles: baseHand.concealedTiles.slice(1) }, "HAND_SIZE");
  });

  it("requires the winning tile to be in the concealed tiles", () => {
    expectInvalid({ ...baseHand, winningTile: "north" }, "WINNING_TILE_MISSING");
  });

  it("rejects a malformed declared sequence", () => {
    expectInvalid(
      {
        ...baseHand,
        concealedTiles: baseHand.concealedTiles.slice(3),
        context: { ...context, riichi: "none" },
        melds: [{ kind: "sequence", open: true, tiles: ["1m", "2m", "4m"] }],
      },
      "INVALID_MELD",
    );
  });

  it("rejects more than four declared groups", () => {
    expectInvalid(
      {
        ...baseHand,
        concealedTiles: [],
        context: { ...context, riichi: "none" },
        melds: [
          { kind: "triplet", open: true, tile: "1m" },
          { kind: "triplet", open: true, tile: "2m" },
          { kind: "triplet", open: true, tile: "3m" },
          { kind: "triplet", open: true, tile: "4m" },
          { kind: "triplet", open: true, tile: "5m" },
        ],
      },
      "TOO_MANY_MELDS",
    );
  });

  it("rejects negative and fractional table counters", () => {
    expectInvalid(
      { ...baseHand, context: { ...context, honba: -1, riichiSticks: 0.5 } },
      "INVALID_CONTEXT",
    );
  });

  it("rejects riichi and ippatsu on an open hand", () => {
    expectInvalid(
      {
        ...baseHand,
        concealedTiles: baseHand.concealedTiles.slice(3),
        context: { ...context, ippatsu: true },
        melds: [{ kind: "sequence", open: true, tiles: ["1m", "2m", "3m"] }],
      },
      "INVALID_CONTEXT",
    );
  });

  it("requires ippatsu to have a riichi declaration", () => {
    expectInvalid(
      { ...baseHand, context: { ...context, ippatsu: true, riichi: "none" } },
      "INVALID_CONTEXT",
    );
  });

  it.each([
    { patch: { chankan: true, method: "tsumo" }, title: "chankan as tsumo" },
    { patch: { method: "ron", rinshan: true }, title: "rinshan as ron" },
    { patch: { lastTile: "haitei", method: "ron" }, title: "haitei as ron" },
    { patch: { lastTile: "houtei", method: "tsumo" }, title: "houtei as tsumo" },
    { patch: { lastTile: "haitei", method: "tsumo", rinshan: true }, title: "rinshan plus haitei" },
    { patch: { chankan: true, method: "ron", rinshan: true }, title: "chankan plus rinshan" },
  ] as const)("rejects $title", ({ patch }) => {
    expectInvalid({ ...baseHand, context: { ...context, ...patch } }, "INVALID_CONTEXT");
  });

  it.each([
    {
      firstTurn: "tenhou",
      patch: { method: "ron", seatWind: "east" },
      title: "tenhou by ron",
    },
    {
      firstTurn: "chiihou",
      patch: { method: "tsumo", seatWind: "east" },
      title: "chiihou by East",
    },
    {
      firstTurn: "renhou",
      patch: { method: "ron", seatWind: "east" },
      title: "renhou by East",
    },
  ] as const)("rejects $title", ({ firstTurn, patch }) => {
    expectInvalid(
      {
        ...baseHand,
        context: { ...context, ...patch, firstTurn, ippatsu: false, riichi: "none" },
      },
      "INVALID_CONTEXT",
    );
  });

  it("rejects first-turn yaku on an open hand", () => {
    expectInvalid(
      {
        ...baseHand,
        concealedTiles: baseHand.concealedTiles.slice(3),
        context: {
          ...context,
          firstTurn: "renhou",
          ippatsu: false,
          riichi: "none",
        },
        melds: [{ kind: "sequence", open: true, tiles: ["1m", "2m", "3m"] }],
      },
      "INVALID_CONTEXT",
    );
  });

  it("rejects later-hand flags combined with a first-turn win", () => {
    expectInvalid(
      {
        ...baseHand,
        context: {
          ...context,
          firstTurn: "chiihou",
          ippatsu: false,
          lastTile: "haitei",
          method: "tsumo",
          riichi: "none",
        },
      },
      "INVALID_CONTEXT",
    );
  });

  it("requires riichi before ura-dora indicators can be counted", () => {
    expectInvalid(
      {
        ...baseHand,
        context: { ...context, riichi: "none" },
        uraDoraIndicators: ["4p"],
      },
      "INVALID_CONTEXT",
    );
  });
});
