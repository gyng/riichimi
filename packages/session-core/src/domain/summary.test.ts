import { describe, expect, it } from "vitest";

import { applyDraw, applyWin, createSession, declareRiichi } from "../application/session";
import type { SessionState } from "./session";
import { formatSessionSummaryText, summarizeSession } from "./summary";

function newTable(): SessionState {
  return createSession({
    id: "table-1",
    playerNames: ["Alice", "Bob", "Cara", "Dan"],
    rulesProfileId: "wrc-2025",
    startedAt: "2026-07-24T02:00:00.000Z",
  });
}

// A non-dealer (South, index 1) ron off West (index 2) worth 3,900.
function ronWin(state: SessionState, id: string): SessionState {
  return applyWin(state, {
    discarderIndex: 2,
    id,
    occurredAt: "2026-07-24T02:05:00.000Z",
    payments: { fromDiscarder: 3900, kind: "ron", total: 3900 },
    winnerIndex: 1,
  });
}

describe("summarizeSession", () => {
  it("ranks a fresh table by seat order at 25,000 each", () => {
    const summary = summarizeSession(newTable());
    expect(
      summary.standings.map((entry) => [entry.placement, entry.name, entry.score, entry.net]),
    ).toEqual([
      [1, "Alice", 25000, 0],
      [2, "Bob", 25000, 0],
      [3, "Cara", 25000, 0],
      [4, "Dan", 25000, 0],
    ]);
    expect(summary.roundsPlayed).toBe(0);
    expect(summary.winCount).toBe(0);
    expect(summary.drawCount).toBe(0);
  });

  it("orders standings by score, with net relative to the 25,000 start", () => {
    // Bob (seat 1) rons Cara (seat 2) for 3,900. Alice and Dan stay tied at 25,000.
    const summary = summarizeSession(ronWin(newTable(), "r1"));
    expect(summary.standings).toEqual([
      { placement: 1, playerId: "table-1-player-2", name: "Bob", score: 28900, net: 3900 },
      { placement: 2, playerId: "table-1-player-1", name: "Alice", score: 25000, net: 0 },
      { placement: 3, playerId: "table-1-player-4", name: "Dan", score: 25000, net: 0 },
      { placement: 4, playerId: "table-1-player-3", name: "Cara", score: 21100, net: -3900 },
    ]);
  });

  it("breaks score ties by seat order (index 0 = starting East)", () => {
    // Alice (seat 0) and Dan (seat 3) both hold 25,000; Alice ranks above Dan.
    const summary = summarizeSession(ronWin(newTable(), "r1"));
    const alice = summary.standings.find((entry) => entry.name === "Alice");
    const dan = summary.standings.find((entry) => entry.name === "Dan");
    expect(alice?.score).toBe(dan?.score);
    expect(alice?.placement).toBeLessThan(dan?.placement ?? 0);
  });

  it("tallies wins and draws and describes each round", () => {
    let state = newTable();
    state = ronWin(state, "r1");
    state = applyDraw(state, {
      id: "d1",
      occurredAt: "2026-07-24T02:10:00.000Z",
      tenpaiPlayerIndices: [0, 1],
    });
    const summary = summarizeSession(state);
    expect(summary.roundsPlayed).toBe(2);
    expect(summary.winCount).toBe(1);
    expect(summary.drawCount).toBe(1);
    expect(summary.rounds.map((round) => round.description)).toEqual([
      "Bob won by ron off Cara",
      "Exhaustive draw — 2 tenpai",
    ]);
  });

  it("does not mutate the session", () => {
    const state = ronWin(newTable(), "r1");
    const before = JSON.stringify(state);
    summarizeSession(state);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("reflects riichi-stick deductions in the live scores", () => {
    const summary = summarizeSession(
      declareRiichi(newTable(), {
        id: "riichi-0",
        occurredAt: "2026-07-23T00:00:30.000Z",
        playerIndex: 0,
      }),
    );
    const alice = summary.standings.find((entry) => entry.name === "Alice");
    expect(alice?.score).toBe(24000);
    expect(alice?.net).toBe(-1000);
  });
});

describe("formatSessionSummaryText", () => {
  it("renders standings and rounds as locale-independent text", () => {
    const summary = summarizeSession(ronWin(newTable(), "r1"));
    const text = formatSessionSummaryText(summary);
    // The header shows the CURRENT round (East 2 after a non-dealer win).
    expect(text).toContain("Richii table — East 2 · 0 honba");
    expect(text).toContain("1 round (1 win, 0 draws)");
    expect(text).toContain("1. Bob — 28,900 (+3,900)");
    expect(text).toContain("4. Cara — 21,100 (-3,900)");
    expect(text).toContain("East 1 · Bob won by ron off Cara · ±0 / +3,900 / -3,900 / ±0");
  });

  it("omits the Rounds section when no rounds have been played", () => {
    const text = formatSessionSummaryText(summarizeSession(newTable()));
    expect(text).not.toContain("Rounds");
    expect(text).toContain("0 rounds (0 wins, 0 draws)");
  });
});
