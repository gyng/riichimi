import { describe, expect, it } from "vitest";

import {
  applyDraw,
  applyWin,
  createSession,
  declareRiichi,
  undoLastSessionChange,
} from "./session";

function session() {
  return createSession({
    id: "game-1",
    playerNames: ["Aki", "Bo", "Chi", "Dai"],
    startedAt: "2026-07-23T00:00:00.000Z",
  });
}

describe("table session", () => {
  it("starts an East 1 table with four equal scores", () => {
    const state = session();

    expect(state.table.players.map(({ score }) => score)).toEqual([25_000, 25_000, 25_000, 25_000]);
    expect(state.table).toMatchObject({
      dealerIndex: 0,
      handNumber: 1,
      honba: 0,
      roundWind: "east",
    });
  });

  it("deducts riichi immediately and awards the pool to a ron winner", () => {
    const declared = declareRiichi(session(), 2);
    const result = applyWin(declared, {
      discarderIndex: 3,
      id: "round-1",
      occurredAt: "2026-07-23T00:01:00.000Z",
      payments: { fromDiscarder: 3900, kind: "ron", total: 3900 },
      winnerIndex: 1,
    });

    expect(result.table.players.map(({ score }) => score)).toEqual([
      25_000, 29_900, 24_000, 21_100,
    ]);
    expect(result.table).toMatchObject({
      dealerIndex: 1,
      handNumber: 2,
      honba: 0,
      riichiSticks: 0,
    });
  });

  it("charges the dealer and non-dealers correctly for a non-dealer tsumo", () => {
    const result = applyWin(session(), {
      discarderIndex: null,
      id: "round-1",
      occurredAt: "2026-07-23T00:01:00.000Z",
      payments: { fromDealer: 2000, fromEachNonDealer: 1000, kind: "tsumo", total: 4000 },
      winnerIndex: 1,
    });

    expect(result.table.players.map(({ score }) => score)).toEqual([
      23_000, 29_000, 24_000, 24_000,
    ]);
  });

  it("keeps the dealer and adds honba after a dealer win", () => {
    const result = applyWin(session(), {
      discarderIndex: 1,
      id: "round-1",
      occurredAt: "2026-07-23T00:01:00.000Z",
      payments: { fromDiscarder: 5800, kind: "ron", total: 5800 },
      winnerIndex: 0,
    });

    expect(result.table).toMatchObject({ dealerIndex: 0, handNumber: 1, honba: 1 });
  });

  it("settles an exhaustive draw and retains a tenpai dealer", () => {
    const result = applyDraw(session(), {
      id: "round-1",
      occurredAt: "2026-07-23T00:01:00.000Z",
      tenpaiPlayerIndices: [0, 2],
    });

    expect(result.table.players.map(({ score }) => score)).toEqual([
      26_500, 23_500, 26_500, 23_500,
    ]);
    expect(result.table).toMatchObject({ dealerIndex: 0, handNumber: 1, honba: 1 });
  });

  it("restores the exact state before the most recent action", () => {
    const initial = session();
    const changed = declareRiichi(initial, 1);

    expect(undoLastSessionChange(changed)).toEqual(initial);
  });

  it("advances East 4 to South 1 after a non-dealer win", () => {
    const initial = session();
    const eastFour = {
      ...initial,
      table: { ...initial.table, dealerIndex: 3, handNumber: 4 },
    };
    const result = applyWin(eastFour, {
      discarderIndex: 2,
      id: "round-4",
      occurredAt: "2026-07-23T00:04:00.000Z",
      payments: { fromDiscarder: 2000, kind: "ron", total: 2000 },
      winnerIndex: 0,
    });

    expect(result.table).toMatchObject({ dealerIndex: 0, handNumber: 1, roundWind: "south" });
  });

  it("advances after a draw when the dealer is not tenpai without exchanging points at zero tenpai", () => {
    const result = applyDraw(session(), {
      id: "round-1",
      occurredAt: "2026-07-23T00:01:00.000Z",
      tenpaiPlayerIndices: [],
    });

    expect(result.table.players.map(({ score }) => score)).toEqual([
      25_000, 25_000, 25_000, 25_000,
    ]);
    expect(result.table).toMatchObject({ dealerIndex: 1, handNumber: 2, honba: 1 });
  });

  it("treats repeated riichi and empty undo as safe no-ops", () => {
    const initial = session();
    const declared = declareRiichi(initial, 1);

    expect(declareRiichi(declared, 1)).toBe(declared);
    expect(undoLastSessionChange(initial)).toBe(initial);
  });

  it("rejects malformed table commands", () => {
    expect(() => createSession({ id: "x", playerNames: ["A"], startedAt: "now" })).toThrow(
      RangeError,
    );
    expect(() => declareRiichi(session(), 7)).toThrow(RangeError);
    expect(() =>
      applyWin(session(), {
        discarderIndex: null,
        id: "x",
        occurredAt: "now",
        payments: { fromDiscarder: 1000, kind: "ron", total: 1000 },
        winnerIndex: 0,
      }),
    ).toThrow("discarding player");
    expect(() =>
      applyWin(session(), {
        discarderIndex: 2,
        id: "x",
        occurredAt: "now",
        payments: {
          fromDealer: 1000,
          fromEachNonDealer: 500,
          kind: "tsumo",
          total: 2000,
        },
        winnerIndex: 1,
      }),
    ).toThrow("cannot have a discarding player");
    expect(() =>
      createSession({ id: "x", playerNames: ["A", "B", "", "D"], startedAt: "now" }),
    ).toThrow("needs a name");
  });
});
