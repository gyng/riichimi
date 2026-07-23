import { describe, expect, it } from "vitest";

import type { RiichiCommand, SessionState } from "../domain/session";
import {
  applyDraw,
  applyWin,
  createSession,
  declareRiichi,
  replaySessionEvents,
  undoLastSessionChange,
} from "./session";

function session() {
  return createSession({
    id: "game-1",
    playerNames: ["Aki", "Bo", "Chi", "Dai"],
    rulesProfileId: "wrc-2025",
    startedAt: "2026-07-23T00:00:00.000Z",
  });
}

function riichi(playerIndex: number, id = `riichi-${playerIndex}`): RiichiCommand {
  return { id, occurredAt: "2026-07-23T00:00:30.000Z", playerIndex };
}

function replayedTable(state: SessionState) {
  const result = replaySessionEvents(state.base, state.events);
  if (result.kind !== "replayed") {
    throw new Error(`Expected a replayable log, got ${result.kind}.`);
  }
  return result.table;
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
      rulesProfileId: "wrc-2025",
    });
  });

  it("deducts riichi immediately and awards the pool to a ron winner", () => {
    const declared = declareRiichi(session(), riichi(2));
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
    const changed = declareRiichi(initial, riichi(1));

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
    const declared = declareRiichi(initial, riichi(1));

    expect(declareRiichi(declared, riichi(1))).toBe(declared);
    expect(undoLastSessionChange(initial)).toBe(initial);
  });

  it("rejects malformed table commands", () => {
    expect(() =>
      createSession({
        id: "x",
        playerNames: ["A"],
        rulesProfileId: "wrc-2025",
        startedAt: "now",
      }),
    ).toThrow(RangeError);
    expect(() => declareRiichi(session(), riichi(7))).toThrow(RangeError);
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
      createSession({
        id: "x",
        playerNames: ["A", "B", "", "D"],
        rulesProfileId: "wrc-2025",
        startedAt: "now",
      }),
    ).toThrow("needs a name");
    expect(() =>
      createSession({
        id: "x",
        playerNames: ["A", "B", "C", "D"],
        rulesProfileId: " ",
        startedAt: "now",
      }),
    ).toThrow("rules profile");
  });
});

describe("event-sourced replay", () => {
  it("rebuilds a dealer-win-repeat table identically to a from-base replay", () => {
    let state = session();
    state = applyWin(state, {
      discarderIndex: 1,
      id: "round-1",
      occurredAt: "2026-07-23T00:01:00.000Z",
      payments: { fromDiscarder: 5800, kind: "ron", total: 5800 },
      winnerIndex: 0,
    });
    state = applyWin(state, {
      discarderIndex: 2,
      id: "round-2",
      occurredAt: "2026-07-23T00:02:00.000Z",
      payments: { fromDiscarder: 2000, kind: "ron", total: 2000 },
      winnerIndex: 0,
    });

    expect(replayedTable(state)).toEqual(state.table);
    expect(replayedTable(state).history).toEqual(state.table.history);
  });

  it("rebuilds a non-dealer tsumo table identically to a from-base replay", () => {
    const state = applyWin(session(), {
      discarderIndex: null,
      id: "round-1",
      occurredAt: "2026-07-23T00:01:00.000Z",
      payments: { fromDealer: 2000, fromEachNonDealer: 1000, kind: "tsumo", total: 4000 },
      winnerIndex: 1,
    });

    expect(replayedTable(state)).toEqual(state.table);
  });

  it("rebuilds a draw-with-carried-sticks table identically to a from-base replay", () => {
    let state = declareRiichi(session(), riichi(0));
    state = applyDraw(state, {
      id: "round-1",
      occurredAt: "2026-07-23T00:01:00.000Z",
      tenpaiPlayerIndices: [0, 2],
    });
    state = applyWin(state, {
      discarderIndex: 3,
      id: "round-2",
      occurredAt: "2026-07-23T00:02:00.000Z",
      payments: { fromDiscarder: 3900, kind: "ron", total: 3900 },
      winnerIndex: 1,
    });

    expect(replayedTable(state)).toEqual(state.table);
    expect(replayedTable(state).history).toEqual(state.table.history);
  });

  it("rebuilds a riichi-then-draw-then-win table identically to a from-base replay", () => {
    let state = declareRiichi(session(), riichi(2));
    state = applyDraw(state, {
      id: "round-1",
      occurredAt: "2026-07-23T00:01:00.000Z",
      tenpaiPlayerIndices: [1, 2],
    });
    state = declareRiichi(state, riichi(3));
    state = applyWin(state, {
      discarderIndex: 3,
      id: "round-2",
      occurredAt: "2026-07-23T00:02:00.000Z",
      payments: { fromDiscarder: 8000, kind: "ron", total: 8000 },
      winnerIndex: 0,
    });

    expect(replayedTable(state)).toEqual(state.table);
    expect(replayedTable(state).history).toEqual(state.table.history);
  });

  it("carries interleaved riichi sticks into a later ron winner's pool payout", () => {
    // declare(P2) -> draw(sticks carry) -> declare(P3) -> P1 wins by ron.
    let state = declareRiichi(session(), riichi(2));
    state = applyDraw(state, {
      id: "round-1",
      occurredAt: "2026-07-23T00:01:00.000Z",
      tenpaiPlayerIndices: [2, 3],
    });
    // The draw carries the single stick; a second declaration adds another.
    expect(state.table.riichiSticks).toBe(1);
    state = declareRiichi(state, riichi(3));
    expect(state.table.riichiSticks).toBe(2);

    // P2 lost 1000 to riichi then the draw paid noten P0/P1 into tenpai P2/P3;
    // P3's riichi then deducted another 1000, leaving both declarers down a stick.
    const beforeWin = state.table.players.map(({ score }) => score);
    expect(beforeWin).toEqual([23_500, 23_500, 25_500, 25_500]);
    state = applyWin(state, {
      discarderIndex: 0,
      id: "round-2",
      occurredAt: "2026-07-23T00:02:00.000Z",
      payments: { fromDiscarder: 1000, kind: "ron", total: 1000 },
      winnerIndex: 1,
    });

    const winRecord = state.table.history.at(-1);
    if (winRecord === undefined || winRecord.kind !== "win") {
      throw new Error("Expected a win record.");
    }
    // Winner receives the 1000 ron plus the 2000 riichi pool (two sticks),
    // and both -1000 riichi deductions remain reflected in the final scores.
    expect(winRecord.deltas[1]).toBe(3000);
    expect(state.table.players.map(({ score }) => score)).toEqual([22_500, 26_500, 25_500, 25_500]);
    expect(state.table.riichiSticks).toBe(0);

    // Replay reproduces the same interleaving byte-for-byte.
    expect(replayedTable(state)).toEqual(state.table);
    expect(replayedTable(state).history).toEqual(state.table.history);
  });

  it("restores the exact prior SessionState on undo after appends", () => {
    const start = session();
    const declared = declareRiichi(start, riichi(1));
    const drawn = applyDraw(declared, {
      id: "round-1",
      occurredAt: "2026-07-23T00:01:00.000Z",
      tenpaiPlayerIndices: [1, 3],
    });

    expect(undoLastSessionChange(drawn)).toEqual(declared);
    expect(undoLastSessionChange(undoLastSessionChange(drawn))).toEqual(start);
  });
});
