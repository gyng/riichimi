import { describe, expect, it } from "vitest";
import type { SessionState, TableState } from "@riichimi/session-core";
import {
  applyDraw,
  applyWin,
  createSession,
  declareRiichi,
  replaySessionEvents,
} from "@riichimi/session-core";

import { parseStoredSession, serializeStoredSession } from "./stored-session";

const legacyTable = {
  dealerIndex: 0,
  declaredRiichiPlayerIndices: [],
  handNumber: 1,
  history: [],
  honba: 0,
  id: "table-1",
  players: ["A", "B", "C", "D"].map((name, index) => ({
    id: `player-${index}`,
    name,
    score: 25_000,
  })),
  riichiSticks: 0,
  roundWind: "east",
  startedAt: "2026-07-23T00:00:00.000Z",
};

// Build a genuine legacy v1 trace by driving the reducers and capturing the
// table after each action — a v1 undoStack held exactly this: one TableState per
// action, chronological. The table shape is unchanged from v1, so the snapshots
// are byte-faithful to what the old reducers persisted.
function legacyV1Payload(steps: readonly ((state: SessionState) => SessionState)[]): {
  readonly finalTable: TableState;
  readonly serialized: string;
  readonly tables: readonly TableState[];
} {
  let state = createSession({
    id: "table-1",
    playerNames: ["Aki", "Bo", "Chi", "Dai"],
    rulesProfileId: "wrc-2025",
    startedAt: "2026-07-23T00:00:00.000Z",
  });
  const tables: TableState[] = [state.table];
  for (const step of steps) {
    state = step(state);
    tables.push(state.table);
  }
  const finalTable = tables.at(-1) ?? state.table;
  // Old shape: { table, undoStack: TableState[] } with no base/events.
  const serialized = JSON.stringify({ table: finalTable, undoStack: tables.slice(0, -1) });
  return { finalTable, serialized, tables };
}

const riichiP2 = (state: SessionState): SessionState =>
  declareRiichi(state, { id: "r2", occurredAt: "2026-07-23T00:00:30.000Z", playerIndex: 2 });
const drawTenpai12 = (state: SessionState): SessionState =>
  applyDraw(state, {
    id: "draw-1",
    occurredAt: "2026-07-23T00:01:00.000Z",
    tenpaiPlayerIndices: [1, 2],
  });
const riichiP3 = (state: SessionState): SessionState =>
  declareRiichi(state, { id: "r3", occurredAt: "2026-07-23T00:01:30.000Z", playerIndex: 3 });
const ronWinByP1 = (state: SessionState): SessionState =>
  applyWin(state, {
    discarderIndex: 3,
    id: "win-1",
    occurredAt: "2026-07-23T00:02:00.000Z",
    payments: { fromDiscarder: 3900, kind: "ron", total: 3900 },
    winnerIndex: 1,
  });

describe("stored table migration", () => {
  it("pins pre-profile tables to WRC 2025 while reshaping to the event log", () => {
    const parsed = parseStoredSession(
      JSON.stringify({ table: legacyTable, undoStack: [legacyTable] }),
    );

    expect(parsed.table.rulesProfileId).toBe("wrc-2025");
    expect(parsed.base.rulesProfileId).toBe("wrc-2025");
  });

  it("preserves an explicitly pinned profile", () => {
    expect(
      parseStoredSession(
        JSON.stringify({
          table: { ...legacyTable, rulesProfileId: "wrc-2025-red-five-table" },
          undoStack: [],
        }),
      ).table.rulesProfileId,
    ).toBe("wrc-2025-red-five-table");
  });

  it("falls back safely when a previously stored profile is no longer supported", () => {
    const parsed = parseStoredSession(
      JSON.stringify({
        table: { ...legacyTable, rulesProfileId: "retired-profile" },
        undoStack: [{ ...legacyTable, rulesProfileId: "retired-profile" }],
      }),
    );

    expect(parsed.table.rulesProfileId).toBe("wrc-2025");
    expect(parsed.base.rulesProfileId).toBe("wrc-2025");
  });
});

describe("v1 -> v2 session reconstruction", () => {
  it("round-trips a legacy session with riichi, a carried-stick draw, and a win", () => {
    const { serialized, finalTable } = legacyV1Payload([
      riichiP2,
      drawTenpai12,
      riichiP3,
      ronWinByP1,
    ]);

    const parsed = parseStoredSession(serialized);

    // Replay is the source of truth: the reconstructed log reproduces the exact
    // final table (scores, sticks, honba, history).
    expect(parsed.table).toEqual(finalTable);
    // The riichi declarations were reconstructed at the right positions, proving
    // timing was preserved rather than only final scores matching.
    expect(parsed.events.map((event) => event.kind)).toEqual(["riichi", "draw", "riichi", "win"]);
    expect(parsed.events[0]).toMatchObject({ kind: "riichi", playerIndex: 2 });
    expect(parsed.events[2]).toMatchObject({ kind: "riichi", playerIndex: 3 });

    // The reconstructed log replays independently to the same table.
    const replayed = replaySessionEvents(parsed.base, parsed.events);
    expect(replayed).toMatchObject({ kind: "replayed", table: finalTable });
  });

  it("restores a lossless baseline when the undo trace is inconsistent", () => {
    const { tables, finalTable } = legacyV1Payload([riichiP2, drawTenpai12, riichiP3, ronWinByP1]);
    // Drop the first riichi snapshot: the final table still reflects that
    // declaration, so the trace can no longer be verified by replay.
    const truncated = [tables[0], ...tables.slice(2, -1)];
    const serialized = JSON.stringify({ table: finalTable, undoStack: truncated });

    const parsed = parseStoredSession(serialized);

    // Scores and history are intact; the rounds are simply not editable.
    expect(parsed.table).toEqual(finalTable);
    expect(parsed.events).toEqual([]);
    expect(parsed.undoStack).toEqual([]);
  });
});

describe("stored v2 round-trip", () => {
  it("saves and reloads an event-sourced session unchanged", () => {
    let state = createSession({
      id: "table-9",
      playerNames: ["Aki", "Bo", "Chi", "Dai"],
      rulesProfileId: "wrc-2025",
      startedAt: "2026-07-23T00:00:00.000Z",
    });
    state = riichiP2(state);
    state = ronWinByP1(state);

    const parsed = parseStoredSession(serializeStoredSession(state));

    expect(parsed.base).toEqual(state.base);
    expect(parsed.events).toEqual(state.events);
    expect(parsed.table).toEqual(state.table);
    expect(parsed.undoStack).toEqual(state.undoStack);
  });

  it("caps the persisted undo stack at the most recent 50 entries", () => {
    const base = createSession({
      id: "table-cap",
      playerNames: ["Aki", "Bo", "Chi", "Dai"],
      rulesProfileId: "wrc-2025",
      startedAt: "2026-07-23T00:00:00.000Z",
    }).base;
    const state: SessionState = {
      base,
      events: [],
      table: base,
      // 60 synthetic prior logs; only the most recent 50 should persist.
      undoStack: Array.from({ length: 60 }, () => []),
    };

    const parsed = parseStoredSession(serializeStoredSession(state));

    expect(parsed.undoStack).toHaveLength(50);
  });
});
