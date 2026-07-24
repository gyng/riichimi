import { describe, expect, it } from "vitest";

import type { SessionEvent } from "../domain/session";
import { createSession, declareRiichi, replaySessionEvents } from "./session";

function baseTable() {
  return createSession({
    id: "table-1",
    playerNames: ["Alice", "Bob", "Cara", "Dan"],
    rulesProfileId: "wrc-2025",
    startedAt: "2026-07-24T02:00:00.000Z",
  }).base;
}

function replay(...events: readonly SessionEvent[]) {
  return replaySessionEvents(baseTable(), events);
}

const occurredAt = "2026-07-24T02:05:00.000Z";

/**
 * A stored or edited event log is untrusted input: it survives reload, undo, and
 * hand editing. Replay has to reject a malformed log as a typed failure rather
 * than apply it and quietly produce wrong scores.
 */
describe("replaying an untrusted event log", () => {
  it("replays a well-formed log", () => {
    const result = replay({
      id: "round-1",
      kind: "draw",
      occurredAt,
      tenpaiPlayerIndices: [0, 1],
    });

    expect(result.kind).toBe("replayed");
  });

  it("rejects a draw naming a seat that does not exist", () => {
    expect(
      replay({ id: "round-1", kind: "draw", occurredAt, tenpaiPlayerIndices: [4] }),
    ).toMatchObject({ eventId: "round-1", kind: "invalid-event" });
  });

  it("rejects a riichi from a seat that does not exist", () => {
    expect(replay({ id: "riichi-1", kind: "riichi", occurredAt, playerIndex: -1 })).toMatchObject({
      eventId: "riichi-1",
      kind: "invalid-event",
    });
  });

  it("treats a repeated riichi as a no-op rather than charging twice", () => {
    const result = replay(
      { id: "riichi-1", kind: "riichi", occurredAt, playerIndex: 0 },
      { id: "riichi-2", kind: "riichi", occurredAt, playerIndex: 0 },
    );

    if (result.kind !== "replayed") {
      throw new Error(`Expected a replay, received ${result.kind}.`);
    }
    // One 1,000-point stick, not two.
    expect(result.table.players[0]?.score).toBe(24000);
    expect(result.table.riichiSticks).toBe(1);
  });

  it("rejects a riichi from a seat that cannot pay the stick", () => {
    let table = baseTable();
    table = {
      ...table,
      players: table.players.map((p, i) => (i === 0 ? { ...p, score: 900 } : p)),
    };

    expect(
      replaySessionEvents(table, [{ id: "riichi-1", kind: "riichi", occurredAt, playerIndex: 0 }]),
    ).toMatchObject({ kind: "riichi-underfunded", playerIndex: 0 });
  });

  it("rejects a win by a seat that does not exist", () => {
    expect(
      replay({
        discarderIndex: null,
        id: "round-1",
        kind: "win",
        occurredAt,
        payments: { fromDealer: null, fromEachNonDealer: 1000, kind: "tsumo", total: 3000 },
        winnerIndex: 9,
      }),
    ).toMatchObject({ eventId: "round-1", kind: "invalid-event" });
  });

  it("rejects a ron with nobody to pay it", () => {
    expect(
      replay({
        discarderIndex: null,
        id: "round-1",
        kind: "win",
        occurredAt,
        payments: { fromDiscarder: 3900, kind: "ron", total: 3900 },
        winnerIndex: 1,
      }),
    ).toMatchObject({ eventId: "round-1", kind: "invalid-event" });
  });

  it("rejects a ron where the winner discarded to themselves", () => {
    expect(
      replay({
        discarderIndex: 1,
        id: "round-1",
        kind: "win",
        occurredAt,
        payments: { fromDiscarder: 3900, kind: "ron", total: 3900 },
        winnerIndex: 1,
      }),
    ).toMatchObject({ eventId: "round-1", kind: "invalid-event" });
  });

  it("rejects a ron naming a discarder who is not at the table", () => {
    expect(
      replay({
        discarderIndex: 7,
        id: "round-1",
        kind: "win",
        occurredAt,
        payments: { fromDiscarder: 3900, kind: "ron", total: 3900 },
        winnerIndex: 1,
      }),
    ).toMatchObject({ eventId: "round-1", kind: "invalid-event" });
  });

  it("rejects a tsumo that also names a discarder", () => {
    expect(
      replay({
        discarderIndex: 2,
        id: "round-1",
        kind: "win",
        occurredAt,
        payments: { fromDealer: null, fromEachNonDealer: 1000, kind: "tsumo", total: 3000 },
        winnerIndex: 1,
      }),
    ).toMatchObject({ eventId: "round-1", kind: "invalid-event" });
  });

  it("stops at the first bad event instead of applying later ones", () => {
    const result = replay(
      { id: "round-1", kind: "draw", occurredAt, tenpaiPlayerIndices: [9] },
      { id: "riichi-1", kind: "riichi", occurredAt, playerIndex: 0 },
    );

    expect(result).toMatchObject({ eventId: "round-1" });
  });
});

describe("declaring riichi through the live command", () => {
  it("refuses a seat that cannot fund the stick", () => {
    const state = createSession({
      id: "table-1",
      playerNames: ["Alice", "Bob", "Cara", "Dan"],
      rulesProfileId: "wrc-2025",
      startedAt: "2026-07-24T02:00:00.000Z",
    });
    const broke = {
      ...state,
      table: {
        ...state.table,
        players: state.table.players.map((p, i) => (i === 0 ? { ...p, score: 500 } : p)),
      },
    };

    expect(() => declareRiichi(broke, { id: "r1", occurredAt, playerIndex: 0 })).toThrow(
      /1,000 points/,
    );
  });
});
