import { describe, expect, it } from "vitest";

import { announceWin } from "./announcement";
import type { ScoreSuccess } from "./score";

function success(overrides: Partial<ScoreSuccess> = {}): ScoreSuccess {
  return {
    basePoints: 2000,
    dora: { dora: 0, redDora: 0, total: 0, uraDora: 0 },
    fu: { items: [], rounded: 30, unrounded: 25 },
    han: 4,
    kind: "success",
    limit: null,
    payments: { fromDiscarder: 8000, kind: "ron", total: 8000 },
    riichiBonus: 0,
    totalGain: 8000,
    yaku: [],
    yakuman: [],
    ...overrides,
  };
}

describe("announceWin", () => {
  it("headlines the highest-value yaku and carries the scored facts", () => {
    const announcement = announceWin(
      success({
        yaku: [
          { han: 1, id: "riichi", name: "立直", romanized: "Riichi" },
          { han: 3, id: "junchan", name: "純全帯幺九", romanized: "Junchan" },
          { han: 2, id: "sanshoku", name: "三色同順", romanized: "Sanshoku" },
        ],
      }),
    );

    // Every yaku, highest han first, so an announcement can read them all out.
    expect(announcement.headline).toEqual(["Junchan", "Sanshoku", "Riichi"]);
    expect(announcement).toMatchObject({ fu: 30, han: 4, method: "ron", points: 8000 });
  });

  it("announces yakuman by name instead of its component yaku", () => {
    const announcement = announceWin(
      success({
        fu: null,
        han: null,
        limit: "yakuman",
        totalGain: 32000,
        yaku: [{ han: 1, id: "riichi", name: "立直", romanized: "Riichi" }],
        yakuman: [{ id: "suuankou", name: "四暗刻", romanized: "Suuankou", value: 1 }],
      }),
    );

    expect(announcement.headline).toEqual(["Suuankou"]);
    expect(announcement).toMatchObject({ fu: null, han: null, limit: "yakuman", points: 32000 });
  });

  it("reports a tsumo win's method so the wording can differ", () => {
    const announcement = announceWin(
      success({
        payments: { fromDealer: 2000, fromEachNonDealer: 1000, kind: "tsumo", total: 4000 },
        totalGain: 4000,
      }),
    );

    expect(announcement.method).toBe("tsumo");
    expect(announcement.points).toBe(4000);
  });
});
