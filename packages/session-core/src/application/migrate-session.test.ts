import { describe, expect, it } from "vitest";

import type { SessionState, TableState } from "../domain/session";
import { reconstructSessionFromSnapshots } from "./migrate-session";
import { applyDraw, applyWin, declareRiichi, createSession, replaySessionEvents } from "./session";

function session(): SessionState {
  return createSession({
    id: "table-1",
    playerNames: ["Aki", "Bo", "Chi", "Dai"],
    rulesProfileId: "wrc-2025",
    startedAt: "2026-07-23T00:00:00.000Z",
  });
}

// A legacy v1 undoStack held one TableState per action. Driving the reducers and
// capturing table after each step reproduces that exact chronological trace,
// since the table-level appliers are the verbatim legacy math.
function legacyTrace(steps: readonly ((state: SessionState) => SessionState)[]): {
  readonly snapshots: readonly TableState[];
  readonly final: SessionState;
} {
  let state = session();
  const snapshots: TableState[] = [state.table];
  for (const step of steps) {
    state = step(state);
    snapshots.push(state.table);
  }
  return { final: state, snapshots };
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

describe("reconstructSessionFromSnapshots", () => {
  it("reconstructs a verified event log from a riichi/draw/win trace", () => {
    const { snapshots, final } = legacyTrace([riichiP2, drawTenpai12, riichiP3, ronWinByP1]);

    const result = reconstructSessionFromSnapshots(snapshots);

    expect(result.kind).toBe("reconstructed");
    // base is kept verbatim (never re-derived via createSession).
    expect(result.state.base).toEqual(snapshots[0]);
    expect(result.state.table).toEqual(final.table);
    expect(result.state.events.map((event) => event.kind)).toEqual([
      "riichi",
      "draw",
      "riichi",
      "win",
    ]);
    // Riichi events land at the right positions with the added player.
    expect(result.state.events[0]).toMatchObject({ kind: "riichi", playerIndex: 2 });
    expect(result.state.events[2]).toMatchObject({ kind: "riichi", playerIndex: 3 });
    // Round events carry the original stored inputs.
    expect(result.state.events[3]).toMatchObject({
      discarderIndex: 3,
      id: "win-1",
      kind: "win",
      winnerIndex: 1,
    });
  });

  it("synthesizes migrated riichi ids and borrows the next round's timestamp", () => {
    const { snapshots } = legacyTrace([riichiP2, drawTenpai12]);

    const result = reconstructSessionFromSnapshots(snapshots);

    expect(result.state.events[0]).toMatchObject({
      id: "riichi-migrated-0",
      kind: "riichi",
      occurredAt: "2026-07-23T00:01:00.000Z", // the draw it precedes
      playerIndex: 2,
    });
  });

  it("uses base.startedAt for a trailing riichi with no following round", () => {
    const { snapshots } = legacyTrace([riichiP2]);

    const result = reconstructSessionFromSnapshots(snapshots);

    expect(result.state.events[0]).toMatchObject({
      kind: "riichi",
      occurredAt: "2026-07-23T00:00:00.000Z",
    });
  });

  it("rebuilds the undo stack as one event-log prefix per prior action", () => {
    const { snapshots } = legacyTrace([riichiP2, drawTenpai12, ronWinByP1]);

    const result = reconstructSessionFromSnapshots(snapshots);

    expect(result.state.undoStack).toHaveLength(3);
    expect(result.state.undoStack[0]).toEqual([]);
    expect(result.state.undoStack[1]).toHaveLength(1);
    expect(result.state.undoStack[2]).toHaveLength(2);
    // The full log is not itself an undo entry (parity with live play).
    expect(result.state.events).toHaveLength(3);
  });

  it("treats a single-snapshot trace as a fresh, editable baseline", () => {
    const { snapshots } = legacyTrace([]);

    const result = reconstructSessionFromSnapshots(snapshots);

    expect(result.kind).toBe("reconstructed");
    expect(result.state.events).toEqual([]);
    expect(result.state.undoStack).toEqual([]);
  });

  it("falls back to a lossless baseline when the trace cannot be verified", () => {
    const { snapshots, final } = legacyTrace([riichiP2, drawTenpai12, riichiP3, ronWinByP1]);
    // Drop the first riichi snapshot: the trace now omits a declaration that the
    // final table still reflects, so replay verification must fail.
    const truncated = [snapshots[0], ...snapshots.slice(2)].filter(
      (table): table is TableState => table !== undefined,
    );

    const result = reconstructSessionFromSnapshots(truncated);

    expect(result.kind).toBe("restored-baseline");
    expect(result.state.events).toEqual([]);
    expect(result.state.undoStack).toEqual([]);
    // Nothing is lost: scores and history match the original final table.
    expect(result.state.table).toEqual(final.table);
    expect(result.state.base).toEqual(final.table);
  });

  it("falls back when a snapshot pair cannot be classified as one action", () => {
    const { snapshots, final } = legacyTrace([riichiP2, drawTenpai12, ronWinByP1]);
    // Drop the draw snapshot so a single pair appears to gain two history records
    // at once — no single action explains it.
    const collapsed = [snapshots[0], snapshots[1], snapshots[3]].filter(
      (table): table is TableState => table !== undefined,
    );

    const result = reconstructSessionFromSnapshots(collapsed);

    expect(result.kind).toBe("restored-baseline");
    expect(result.state.events).toEqual([]);
    expect(result.state.table).toEqual(final.table);
  });

  it("rejects an empty snapshot trace as a programmer error", () => {
    expect(() => reconstructSessionFromSnapshots([])).toThrow(/empty snapshot trace/);
  });

  it("produces a log that replays byte-for-byte to the final snapshot", () => {
    const { snapshots, final } = legacyTrace([riichiP2, drawTenpai12, riichiP3, ronWinByP1]);

    const result = reconstructSessionFromSnapshots(snapshots);
    const replayed = replaySessionEvents(result.state.base, result.state.events);

    expect(replayed).toMatchObject({ kind: "replayed", table: final.table });
  });
});

describe("reconstructing from an unusable trace", () => {
  it("refuses an empty snapshot trace rather than inventing a table", () => {
    expect(() => reconstructSessionFromSnapshots([])).toThrow(/empty snapshot trace/);
  });

  it("falls back to the newest snapshot when a step cannot be explained", () => {
    const start = session();
    // A jump that no single legacy action produces: two rounds appear at once,
    // so the trace cannot be turned into an event log.
    const jumped = applyWin(
      applyDraw(start, {
        id: "r1",
        occurredAt: "2026-07-23T00:01:00.000Z",
        tenpaiPlayerIndices: [],
      }),
      {
        discarderIndex: 0,
        id: "r2",
        occurredAt: "2026-07-23T00:02:00.000Z",
        payments: { fromDiscarder: 1000, kind: "ron", total: 1000 },
        winnerIndex: 1,
      },
    );

    const result = reconstructSessionFromSnapshots([start.table, jumped.table]);

    // The table is preserved exactly; only the ability to edit history is lost.
    expect(result.state.table).toEqual(jumped.table);
    expect(result.state.events).toEqual([]);
  });

  it("preserves a single-snapshot trace as a baseline with no editable history", () => {
    const start = session();

    const result = reconstructSessionFromSnapshots([start.table]);

    expect(result.state.table).toEqual(start.table);
    expect(result.state.events).toEqual([]);
  });
});
