import { describe, expect, it } from "vitest";

import type { RiichiCommand, SessionState, WinRecord } from "../domain/session";
import {
  editableRoundIds,
  editSessionRound,
  previewSessionEdit,
  tableBeforeRound,
} from "./edit-session";
import {
  applyDraw,
  applyWin,
  createSession,
  declareRiichi,
  undoLastSessionChange,
} from "./session";

const occurredAt = "2026-07-23T00:01:00.000Z";

function session(): SessionState {
  return createSession({
    id: "game-1",
    playerNames: ["Aki", "Bo", "Chi", "Dai"],
    rulesProfileId: "wrc-2025",
    startedAt: "2026-07-23T00:00:00.000Z",
  });
}

function riichi(playerIndex: number, id: string): RiichiCommand {
  return { id, occurredAt, playerIndex };
}

function ron(id: string, winnerIndex: number, discarderIndex: number, amount: number) {
  return {
    discarderIndex,
    id,
    occurredAt,
    payments: { fromDiscarder: amount, kind: "ron", total: amount } as const,
    winnerIndex,
  };
}

function tsumo(
  id: string,
  winnerIndex: number,
  fromDealer: number | null,
  fromEachNonDealer: number,
) {
  const total =
    (fromDealer ?? fromEachNonDealer) + fromEachNonDealer * (fromDealer === null ? 3 : 2);
  return {
    discarderIndex: null,
    id,
    occurredAt,
    payments: { fromDealer, fromEachNonDealer, kind: "tsumo", total } as const,
    winnerIndex,
  };
}

function scores(state: SessionState): readonly number[] {
  return state.table.players.map(({ score }) => score);
}

function winRecord(state: SessionState, id: string): WinRecord {
  const record = state.table.history.find((entry) => entry.id === id);
  if (record === undefined || record.kind !== "win") {
    throw new Error(`Expected a win record with id ${id}.`);
  }
  return record;
}

describe("editSessionRound — recompute", () => {
  it("replays downstream context and scores from scratch after replacing a winner", () => {
    const original = applyWin(
      applyWin(applyWin(session(), ron("r1", 1, 2, 1000)), ron("r2", 2, 3, 2000)),
      ron("r3", 0, 1, 3900),
    );

    const edited = editSessionRound(original, {
      kind: "replace-round",
      revision: {
        discarderIndex: 2,
        kind: "win",
        payments: ron("r1", 0, 2, 1000).payments,
        winnerIndex: 0,
      },
      roundId: "r1",
    });
    expect(edited.kind).toBe("edited");
    if (edited.kind !== "edited") {
      return;
    }

    const fromScratch = applyWin(
      applyWin(applyWin(session(), ron("r1", 0, 2, 1000)), ron("r2", 2, 3, 2000)),
      ron("r3", 0, 1, 3900),
    );

    expect(edited.state.table).toEqual(fromScratch.table);
    expect(edited.review.scoreChanges).toEqual(
      fromScratch.table.players.map(
        (player, index) => player.score - original.table.players[index]!.score,
      ),
    );
    // A dealer win at East 1 now repeats, shifting the later rounds' context.
    const changedIds = edited.review.changedRounds.map((change) => change.roundId);
    expect(changedIds).toContain("r2");
    expect(changedIds).toContain("r3");
  });

  it("rebuilds the honba chain when a dealer-repeat win is deleted", () => {
    const original = applyWin(
      applyWin(applyWin(session(), ron("r1", 0, 1, 2000)), ron("r2", 0, 1, 2000)),
      ron("r3", 1, 2, 1000),
    );
    // Original honba chain: r1 East1 h0, r2 East1 h1, r3 East1 h2.
    expect(winRecord(original, "r2").honba).toBe(1);
    expect(winRecord(original, "r3").honba).toBe(2);

    const edited = editSessionRound(original, { kind: "delete-round", roundId: "r1" });
    expect(edited.kind).toBe("edited");
    if (edited.kind !== "edited") {
      return;
    }

    const fromScratch = applyWin(applyWin(session(), ron("r2", 0, 1, 2000)), ron("r3", 1, 2, 1000));
    expect(edited.state.table).toEqual(fromScratch.table);

    const byRound = new Map(edited.review.changedRounds.map((change) => [change.roundId, change]));
    expect(byRound.get("r2")?.before.honba).toBe(1);
    expect(byRound.get("r2")?.after.honba).toBe(0);
    expect(byRound.get("r3")?.before.honba).toBe(2);
    expect(byRound.get("r3")?.after.honba).toBe(1);
  });
});

describe("editSessionRound — riichi timing preservation", () => {
  // P2 riichi, draw (stick carries), P3 riichi, P1 ron: pool payout is 2 * 1000.
  function buildPool(): SessionState {
    return applyWin(
      declareRiichi(
        applyDraw(declareRiichi(session(), riichi(2, "riichi-a")), {
          id: "draw-1",
          occurredAt,
          tenpaiPlayerIndices: [2],
        }),
        riichi(3, "riichi-b"),
      ),
      ron("win-1", 1, 0, 1000),
    );
  }

  it("keeps both riichi deductions and the pool payout when a draw's tenpai set is edited", () => {
    const original = buildPool();
    expect(winRecord(original, "win-1").deltas[1]).toBe(3000); // 1000 ron + 2000 pool

    const edited = editSessionRound(original, {
      kind: "replace-round",
      revision: { kind: "draw", tenpaiPlayerIndices: [2, 3] },
      roundId: "draw-1",
    });
    expect(edited.kind).toBe("edited");
    if (edited.kind !== "edited") {
      return;
    }
    // Pool payout unchanged; both riichi sticks still funded the pool.
    expect(winRecord(edited.state, "win-1").deltas[1]).toBe(3000);
  });

  it("removes a deleted draw's segment riichi and recomputes the later pool", () => {
    const original = buildPool();

    const edited = editSessionRound(original, { kind: "delete-round", roundId: "draw-1" });
    expect(edited.kind).toBe("edited");
    if (edited.kind !== "edited") {
      return;
    }
    // The draw's segment riichi (P2) is gone; only P3's stick remains → pool 1000.
    expect(winRecord(edited.state, "win-1").deltas[1]).toBe(2000); // 1000 ron + 1000 pool
    // P2's declaration was removed, so P2 keeps the 1000 it had deducted.
    expect(
      edited.state.events.some((event) => event.kind === "riichi" && event.playerIndex === 2),
    ).toBe(false);
    expect(
      edited.state.events.some((event) => event.kind === "riichi" && event.playerIndex === 3),
    ).toBe(true);
  });
});

describe("editSessionRound — warnings", () => {
  it("warns about a stale honba payment for exactly the affected later win", () => {
    const original = applyWin(applyWin(session(), ron("r1", 0, 1, 2000)), ron("r2", 2, 3, 2000));
    // r2 replays at East 2 honba 0 originally, but at East 1 honba 0 after r1 (a
    // dealer repeat) is deleted — its stored honba shifts from 1... actually the
    // dealer repeat put r2 at honba 1; deletion drops it to honba 0.
    expect(winRecord(original, "r2").honba).toBe(1);

    const edited = editSessionRound(original, { kind: "delete-round", roundId: "r1" });
    expect(edited.kind).toBe("edited");
    if (edited.kind !== "edited") {
      return;
    }
    expect(edited.review.warnings).toEqual([
      { afterHonba: 0, beforeHonba: 1, kind: "stale-honba-payment", roundId: "r2" },
    ]);
  });

  it("warns about a stale dealer payment when a later tsumo's dealer flips", () => {
    const original = applyWin(
      applyWin(session(), ron("r1", 1, 2, 1000)),
      tsumo("r2", 1, null, 1000),
    );
    // r1 rotates the dealer to seat 1, so r2 is a dealer tsumo by seat 1.

    const edited = editSessionRound(original, {
      kind: "replace-round",
      revision: {
        discarderIndex: 2,
        kind: "win",
        payments: ron("r1", 0, 2, 1000).payments,
        winnerIndex: 0,
      },
      roundId: "r1",
    });
    // Making r1 a dealer win keeps seat 0 as dealer, so r2's winner (seat 1) is no
    // longer the dealer — the tsumo split was computed for the old seating.
    expect(edited.kind).toBe("edited");
    if (edited.kind !== "edited") {
      return;
    }
    expect(edited.review.warnings).toContainEqual({ kind: "stale-dealer-payment", roundId: "r2" });
  });
});

describe("editSessionRound — typed rejections leave state untouched", () => {
  it("rejects an unknown round as round-not-found without mutating state", () => {
    const before = applyWin(session(), ron("r1", 1, 2, 1000));
    const snapshot = structuredClone(before);

    const result = editSessionRound(before, { kind: "delete-round", roundId: "missing" });
    expect(result).toEqual({
      error: { kind: "round-not-found", roundId: "missing" },
      kind: "rejected",
    });
    expect(before).toEqual(snapshot);
  });

  it("rejects a ron revision whose discarder is the winner", () => {
    const state = applyWin(session(), ron("r1", 1, 2, 1000));
    const result = editSessionRound(state, {
      kind: "replace-round",
      revision: {
        discarderIndex: 1,
        kind: "win",
        payments: ron("r1", 1, 0, 1000).payments,
        winnerIndex: 1,
      },
      roundId: "r1",
    });
    expect(result.kind).toBe("rejected");
    if (result.kind !== "rejected") {
      return;
    }
    expect(result.error.kind).toBe("invalid-revision");
  });

  it("rejects a ron revision with no discarder", () => {
    const state = applyWin(session(), ron("r1", 1, 2, 1000));
    const result = editSessionRound(state, {
      kind: "replace-round",
      revision: {
        discarderIndex: null,
        kind: "win",
        payments: { fromDiscarder: 1000, kind: "ron", total: 1000 },
        winnerIndex: 1,
      },
      roundId: "r1",
    });
    expect(result.kind).toBe("rejected");
    if (result.kind !== "rejected") {
      return;
    }
    expect(result.error.kind).toBe("invalid-revision");
  });

  it("rejects a tsumo revision that names a discarder", () => {
    const state = applyWin(session(), ron("r1", 1, 2, 1000));
    const result = editSessionRound(state, {
      kind: "replace-round",
      revision: {
        discarderIndex: 0,
        kind: "win",
        payments: { fromDealer: 2000, fromEachNonDealer: 1000, kind: "tsumo", total: 4000 },
        winnerIndex: 1,
      },
      roundId: "r1",
    });
    expect(result.kind).toBe("rejected");
    if (result.kind !== "rejected") {
      return;
    }
    expect(result.error.kind).toBe("invalid-revision");
  });

  it("rejects an edit that drains a later declarer below 1,000 as riichi-underfunded", () => {
    // r1 gives seat 0 the win off seat 1, leaving seat 1 at 2,000; seat 1 then
    // declares riichi (down to 1,000). Raising r1's payment drops seat 1 below
    // 1,000 at that later declaration.
    const funded = declareRiichi(
      applyWin(session(), ron("r1", 0, 1, 23_000)),
      riichi(1, "riichi-late"),
    );
    expect(scores(funded)[1]).toBe(1000); // 25000 - 23000 - 1000 riichi
    const snapshot = structuredClone(funded);
    const result = editSessionRound(funded, {
      kind: "replace-round",
      revision: {
        discarderIndex: 1,
        kind: "win",
        payments: ron("r1", 0, 1, 24_500).payments,
        winnerIndex: 0,
      },
      roundId: "r1",
    });
    expect(result.kind).toBe("rejected");
    if (result.kind !== "rejected") {
      return;
    }
    expect(result.error).toEqual({
      eventId: "riichi-late",
      kind: "riichi-underfunded",
      playerIndex: 1,
    });
    expect(funded).toEqual(snapshot);
  });

  it("rejects editing a round that lives inside a restored baseline", () => {
    const played = applyWin(session(), ron("r1", 1, 2, 1000));
    const baseline: SessionState = {
      base: played.table,
      events: [],
      table: played.table,
      undoStack: [],
    };
    const snapshot = structuredClone(baseline);

    const result = editSessionRound(baseline, { kind: "delete-round", roundId: "r1" });
    expect(result).toEqual({
      error: { kind: "round-not-editable", roundId: "r1" },
      kind: "rejected",
    });
    expect(baseline).toEqual(snapshot);
    expect(editableRoundIds(baseline).size).toBe(0);
  });
});

describe("editSessionRound — undo and preview", () => {
  it("restores the exact pre-edit state after undo", () => {
    const original = applyWin(applyWin(session(), ron("r1", 1, 2, 1000)), ron("r2", 2, 3, 2000));

    const edited = editSessionRound(original, { kind: "delete-round", roundId: "r1" });
    expect(edited.kind).toBe("edited");
    if (edited.kind !== "edited") {
      return;
    }
    expect(undoLastSessionChange(edited.state)).toEqual(original);
  });

  it("previews the same review that a commit would produce", () => {
    const original = applyWin(applyWin(session(), ron("r1", 1, 2, 1000)), ron("r2", 2, 3, 2000));
    const command = { kind: "delete-round", roundId: "r1" } as const;

    const preview = previewSessionEdit(original, command);
    const commit = editSessionRound(original, command);
    expect(preview.kind).toBe("edited");
    expect(commit.kind).toBe("edited");
    if (preview.kind !== "edited" || commit.kind !== "edited") {
      return;
    }
    expect(preview.review).toEqual(commit.review);
    // The caller may discard the preview's state; the original is never mutated.
    expect(original.events).toHaveLength(2);
  });
});

describe("editSessionRound — set-hand-riichi", () => {
  it("rewrites a completed round's declarations, keeping the round outcome", () => {
    // Seat 0 declares riichi, then rons seat 1 for 1000, reclaiming the pool.
    const original = applyWin(declareRiichi(session(), riichi(0, "ra")), ron("win-1", 0, 1, 1000));
    expect(winRecord(original, "win-1").deltas[0]).toBe(2000); // 1000 ron + 1000 own pool

    const edited = editSessionRound(original, {
      declarations: [{ id: "rb", occurredAt, playerIndex: 2 }],
      kind: "set-hand-riichi",
      roundId: "win-1",
    });
    expect(edited.kind).toBe("edited");
    if (edited.kind !== "edited") {
      return;
    }
    // Seat 2 now funds the pool instead of seat 0; the win still pays the pool out.
    expect(winRecord(edited.state, "win-1").deltas[0]).toBe(2000);
    expect(
      edited.state.events.some((event) => event.kind === "riichi" && event.playerIndex === 0),
    ).toBe(false);
    expect(
      edited.state.events.some((event) => event.kind === "riichi" && event.playerIndex === 2),
    ).toBe(true);
  });

  it("rewrites the current in-progress hand's declarations when roundId is null", () => {
    const original = declareRiichi(applyWin(session(), ron("r1", 1, 2, 1000)), riichi(2, "rc"));
    expect(original.table.declaredRiichiPlayerIndices).toEqual([2]);

    const edited = editSessionRound(original, {
      declarations: [{ id: "rd", occurredAt, playerIndex: 3 }],
      kind: "set-hand-riichi",
      roundId: null,
    });
    expect(edited.kind).toBe("edited");
    if (edited.kind !== "edited") {
      return;
    }
    expect(edited.state.table.declaredRiichiPlayerIndices).toEqual([3]);
    expect(edited.state.table.riichiSticks).toBe(1);
  });

  it("rejects duplicate declarations in a single hand", () => {
    const state = declareRiichi(session(), riichi(0, "ra"));
    const result = editSessionRound(state, {
      declarations: [
        { id: "rb", occurredAt, playerIndex: 1 },
        { id: "rc", occurredAt, playerIndex: 1 },
      ],
      kind: "set-hand-riichi",
      roundId: null,
    });
    expect(result.kind).toBe("rejected");
    if (result.kind !== "rejected") {
      return;
    }
    expect(result.error.kind).toBe("invalid-revision");
  });

  it("rejects a declaration for a seat outside the table", () => {
    const state = declareRiichi(session(), riichi(0, "ra"));
    const result = editSessionRound(state, {
      declarations: [{ id: "rb", occurredAt, playerIndex: 4 }],
      kind: "set-hand-riichi",
      roundId: null,
    });
    expect(result.kind).toBe("rejected");
    if (result.kind !== "rejected") {
      return;
    }
    expect(result.error.kind).toBe("invalid-revision");
  });
});

describe("editSessionRound — draw revision validation", () => {
  it("rejects a draw revision with a tenpai seat outside the table", () => {
    const state = applyDraw(session(), { id: "draw-1", occurredAt, tenpaiPlayerIndices: [0] });
    const result = editSessionRound(state, {
      kind: "replace-round",
      revision: { kind: "draw", tenpaiPlayerIndices: [0, 5] },
      roundId: "draw-1",
    });
    expect(result.kind).toBe("rejected");
    if (result.kind !== "rejected") {
      return;
    }
    expect(result.error.kind).toBe("invalid-revision");
  });
});

describe("editableRoundIds and tableBeforeRound", () => {
  it("reports only the win/draw event ids in the live log", () => {
    const state = applyWin(declareRiichi(session(), riichi(0, "riichi-x")), ron("r1", 1, 2, 1000));
    expect([...editableRoundIds(state)]).toEqual(["r1"]);
  });

  it("returns the replayed context immediately before a round", () => {
    const state = applyWin(applyWin(session(), ron("r1", 1, 2, 1000)), ron("r2", 2, 3, 2000));
    const before = tableBeforeRound(state, "r2");
    expect(before).not.toBeNull();
    expect(before?.dealerIndex).toBe(1);
    expect(before?.handNumber).toBe(2);
    expect(tableBeforeRound(state, "missing")).toBeNull();
  });
});
