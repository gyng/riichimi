import { describe, expect, it } from "vitest";

import type { SessionState } from "../domain/session";
import { handRiichiPlayerIndices, previewSessionEdit } from "./edit-session";
import { applyDraw, applyWin, createSession, declareRiichi } from "./session";

const occurredAt = "2026-07-23T00:01:00.000Z";

function session(): SessionState {
  return createSession({
    id: "game-1",
    playerNames: ["Aki", "Bo", "Chi", "Dai"],
    rulesProfileId: "wrc-2025",
    startedAt: "2026-07-23T00:00:00.000Z",
  });
}

function withRon(state: SessionState, id = "round-1"): SessionState {
  return applyWin(state, {
    discarderIndex: 0,
    id,
    occurredAt,
    payments: { fromDiscarder: 5200, kind: "ron", total: 5200 },
    winnerIndex: 1,
  });
}

/**
 * A correction rewrites history, so a malformed one has to be refused before it
 * replaces a round. Each case below would otherwise re-value hands that were
 * already scored and paid.
 */
describe("refusing a malformed correction", () => {
  it("refuses a round that is not in the log", () => {
    expect(
      previewSessionEdit(withRon(session()), {
        kind: "replace-round",
        revision: {
          discarderIndex: 0,
          kind: "win",
          payments: { fromDiscarder: 1000, kind: "ron", total: 1000 },
          winnerIndex: 1,
        },
        roundId: "no-such-round",
      }),
    ).toMatchObject({ error: { kind: "round-not-found" }, kind: "rejected" });
  });

  it("refuses a winner who is not at the table", () => {
    expect(
      previewSessionEdit(withRon(session()), {
        kind: "replace-round",
        revision: {
          discarderIndex: 0,
          kind: "win",
          payments: { fromDiscarder: 1000, kind: "ron", total: 1000 },
          winnerIndex: 9,
        },
        roundId: "round-1",
      }),
    ).toMatchObject({ error: { kind: "invalid-revision" }, kind: "rejected" });
  });

  it("refuses a ron whose discarder is not at the table", () => {
    expect(
      previewSessionEdit(withRon(session()), {
        kind: "replace-round",
        revision: {
          discarderIndex: 7,
          kind: "win",
          payments: { fromDiscarder: 1000, kind: "ron", total: 1000 },
          winnerIndex: 1,
        },
        roundId: "round-1",
      }),
    ).toMatchObject({ error: { kind: "invalid-revision" }, kind: "rejected" });
  });

  it("refuses a ron with nobody to pay it", () => {
    expect(
      previewSessionEdit(withRon(session()), {
        kind: "replace-round",
        revision: {
          discarderIndex: null,
          kind: "win",
          payments: { fromDiscarder: 1000, kind: "ron", total: 1000 },
          winnerIndex: 1,
        },
        roundId: "round-1",
      }),
    ).toMatchObject({ error: { kind: "invalid-revision" }, kind: "rejected" });
  });

  it("refuses a tsumo that also names a discarder", () => {
    expect(
      previewSessionEdit(withRon(session()), {
        kind: "replace-round",
        revision: {
          discarderIndex: 2,
          kind: "win",
          payments: { fromDealer: null, fromEachNonDealer: 1000, kind: "tsumo", total: 3000 },
          winnerIndex: 1,
        },
        roundId: "round-1",
      }),
    ).toMatchObject({ error: { kind: "invalid-revision" }, kind: "rejected" });
  });
});

describe("riichi declared during a hand", () => {
  it("reports the seats that declared, in declaration order", () => {
    let state = session();
    state = declareRiichi(state, { id: "r-1", occurredAt, playerIndex: 2 });
    state = declareRiichi(state, { id: "r-2", occurredAt, playerIndex: 0 });
    state = withRon(state);

    expect(handRiichiPlayerIndices(state, "round-1")).toEqual([2, 0]);
  });

  it("reports nothing for a hand where nobody declared", () => {
    const state = withRon(session());

    expect(handRiichiPlayerIndices(state, "round-1")).toEqual([]);
  });

  it("reports nothing for a round that is not in the log", () => {
    const state = withRon(session());

    expect(handRiichiPlayerIndices(state, "no-such-round")).toEqual([]);
  });

  it("keeps each hand's declarations separate", () => {
    let state = session();
    state = declareRiichi(state, { id: "r-1", occurredAt, playerIndex: 3 });
    state = applyDraw(state, { id: "round-1", occurredAt, tenpaiPlayerIndices: [3] });
    state = declareRiichi(state, { id: "r-2", occurredAt, playerIndex: 1 });
    state = withRon(state, "round-2");

    expect(handRiichiPlayerIndices(state, "round-1")).toEqual([3]);
    expect(handRiichiPlayerIndices(state, "round-2")).toEqual([1]);
  });
});
