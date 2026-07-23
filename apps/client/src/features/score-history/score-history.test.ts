import type { ScoreHandInput, ScoreSuccess } from "@riichimi/score-core";
import { wrc2025Rules } from "@riichimi/rules";

import {
  addScoreHistoryEntry,
  createScoreHistoryEntry,
  emptyScoreHistory,
  parseScoreHistory,
  removeScoreHistoryEntry,
} from "./score-history";

const hand: ScoreHandInput = {
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
  context: {
    chankan: false,
    firstTurn: "none",
    honba: 0,
    ippatsu: false,
    lastTile: "none",
    method: "tsumo",
    riichi: "none",
    riichiSticks: 0,
    rinshan: false,
    roundWind: "east",
    seatWind: "south",
  },
  doraIndicators: ["9s"],
  melds: [],
  rules: wrc2025Rules,
  uraDoraIndicators: [],
  winningTile: "4s",
};

const result: ScoreSuccess = {
  basePoints: 320,
  dora: { dora: 0, redDora: 0, total: 0, uraDora: 0 },
  fu: { items: [{ fu: 20, reason: "Winning hand" }], rounded: 20, unrounded: 20 },
  han: 2,
  kind: "success",
  limit: null,
  payments: { fromDealer: 700, fromEachNonDealer: 400, kind: "tsumo", total: 1500 },
  riichiBonus: 0,
  totalGain: 1500,
  yaku: [
    {
      han: 1,
      id: "menzen-tsumo",
      name: "Fully concealed hand",
      romanized: "Menzen tsumo",
    },
  ],
  yakuman: [],
};

function entry(id: string, calculatedAt = "2026-07-23T05:00:00.000Z") {
  return createScoreHistoryEntry({ calculatedAt, hand, id, result });
}

describe("score history", () => {
  it("stores an auditable score snapshot", () => {
    const created = entry("score-1");

    expect(created).toMatchObject({
      context: { method: "tsumo", roundWind: "east", seatWind: "south" },
      hand: { doraCount: 1, meldCount: 0, winningTile: "4s" },
      result: { fu: 20, han: 2, totalGain: 1500 },
      rules: { id: "wrc-2025" },
    });
  });

  it("moves a recalculated hand to the front without duplicating it", () => {
    const first = entry("score-1");
    const second = entry("score-2", "2026-07-23T05:01:00.000Z");
    const state = addScoreHistoryEntry(addScoreHistoryEntry(emptyScoreHistory, first), second);

    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]?.id).toBe("score-2");
  });

  it("caps history and removes individual entries", () => {
    const distinct = [0, 1, 2].reduce(
      (state, index) =>
        addScoreHistoryEntry(
          state,
          { ...entry(`score-${index}`), fingerprint: `hand-${index}` },
          2,
        ),
      emptyScoreHistory,
    );

    expect(distinct.entries.map(({ id }) => id)).toEqual(["score-2", "score-1"]);
    expect(removeScoreHistoryEntry(distinct, "score-2").entries.map(({ id }) => id)).toEqual([
      "score-1",
    ]);
  });

  it("round-trips valid storage and rejects malformed nested data", () => {
    const state = addScoreHistoryEntry(emptyScoreHistory, entry("score-1"));

    expect(parseScoreHistory(JSON.stringify(state))).toEqual(state);
    expect(() => parseScoreHistory('{"version":1,"entries":[{"id":"broken"}]}')).toThrow(
      "unsupported format",
    );
  });
});
