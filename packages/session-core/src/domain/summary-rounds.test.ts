import { describe, expect, it } from "vitest";

import { applyDraw, applyWin, createSession } from "../application/session";
import type { SessionState } from "./session";
import { summarizeSession } from "./summary";

function newTable(): SessionState {
  return createSession({
    id: "table-1",
    playerNames: ["Alice", "Bob", "Cara", "Dan"],
    rulesProfileId: "wrc-2025",
    startedAt: "2026-07-24T02:00:00.000Z",
  });
}

function roundLines(state: SessionState): readonly string[] {
  return summarizeSession(state).rounds.map(({ description }) => description);
}

// The round log is what a player reads back when a score is questioned, so each
// outcome has to describe itself unambiguously.
describe("round descriptions", () => {
  it("names the winner and the discarder for a ron", () => {
    const state = applyWin(newTable(), {
      discarderIndex: 2,
      id: "round-1",
      occurredAt: "2026-07-24T02:05:00.000Z",
      payments: { fromDiscarder: 3900, kind: "ron", total: 3900 },
      winnerIndex: 1,
    });

    expect(roundLines(state)[0]).toBe("Bob won by ron off Cara");
  });

  it("names only the winner for a tsumo, which has no discarder", () => {
    const state = applyWin(newTable(), {
      discarderIndex: null,
      id: "round-1",
      occurredAt: "2026-07-24T02:05:00.000Z",
      payments: { fromDealer: null, fromEachNonDealer: 1000, kind: "tsumo", total: 3000 },
      winnerIndex: 0,
    });

    expect(roundLines(state)[0]).toBe("Alice won by tsumo");
  });

  it("distinguishes a draw where nobody was ready", () => {
    const state = applyDraw(newTable(), {
      id: "round-1",
      occurredAt: "2026-07-24T02:05:00.000Z",
      tenpaiPlayerIndices: [],
    });

    expect(roundLines(state)[0]).toBe("Exhaustive draw — all noten");
  });

  it("distinguishes a draw where everyone was ready", () => {
    const state = applyDraw(newTable(), {
      id: "round-1",
      occurredAt: "2026-07-24T02:05:00.000Z",
      tenpaiPlayerIndices: [0, 1, 2, 3],
    });

    expect(roundLines(state)[0]).toBe("Exhaustive draw — all tenpai");
  });

  it("counts the ready players for a partial draw", () => {
    const state = applyDraw(newTable(), {
      id: "round-1",
      occurredAt: "2026-07-24T02:05:00.000Z",
      tenpaiPlayerIndices: [0, 2],
    });

    expect(roundLines(state)[0]).toBe("Exhaustive draw — 2 tenpai");
  });

  it("tallies wins and draws separately across a table", () => {
    let state = applyDraw(newTable(), {
      id: "round-1",
      occurredAt: "2026-07-24T02:05:00.000Z",
      tenpaiPlayerIndices: [1],
    });
    state = applyWin(state, {
      discarderIndex: 0,
      id: "round-2",
      occurredAt: "2026-07-24T02:15:00.000Z",
      payments: { fromDiscarder: 1000, kind: "ron", total: 1000 },
      winnerIndex: 3,
    });

    const summary = summarizeSession(state);
    expect(summary).toMatchObject({ drawCount: 1, roundsPlayed: 2, winCount: 1 });
  });
});
