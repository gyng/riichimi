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
          { han: 1, id: "riichi", japanese: "立直", name: "Riichi", romanized: "Riichi" },
          { han: 3, id: "junchan", japanese: "純全帯幺九", name: "Perfect ends", romanized: "Junchan" }, // prettier-ignore
          { han: 2, id: "sanshoku-doujun", japanese: "三色同順", name: "Mixed sequences", romanized: "Sanshoku doujun" }, // prettier-ignore
        ],
      }),
    );

    // Every yaku, cheapest first, so the reading builds towards the big one
    // instead of opening on it. Each carries the reading a voice needs.
    expect(announcement.headline).toEqual([
      { kana: "リーチ", romaji: "Riichi" },
      { kana: "サンショクドウジュン", romaji: "Sanshoku doujun" },
      { kana: "ジュンチャン", romaji: "Junchan" },
    ]);
    expect(announcement).toMatchObject({ fu: 30, han: 4, method: "ron", points: 8000 });
  });

  it("announces yakuman by name instead of its component yaku", () => {
    const announcement = announceWin(
      success({
        fu: null,
        han: null,
        limit: "yakuman",
        totalGain: 32000,
        yaku: [{ han: 1, id: "riichi", japanese: "立直", name: "Riichi", romanized: "Riichi" }],
        yakuman: [
          { id: "suuankou", japanese: "四暗刻", name: "Four concealed triplets", romanized: "Suuankou", value: 1 }, // prettier-ignore
        ],
      }),
    );

    expect(announcement.headline).toEqual([{ kana: "スーアンコー", romaji: "Suuankou" }]);
    expect(announcement).toMatchObject({ fu: null, han: null, limit: "yakuman", points: 32000 });
  });

  it("refuses an id the catalogue has never heard of, rather than announcing it", () => {
    // The reading has to come from somewhere; a yaku with no catalogue entry
    // has no reading, and guessing one is how a voice ends up saying nonsense.
    expect(() =>
      announceWin(
        success({
          yaku: [{ han: 1, id: "not-a-yaku", japanese: "?", name: "?", romanized: "?" }],
        }),
      ),
    ).toThrow("No catalogue entry for yaku not-a-yaku.");
  });

  it("carries the dora counts so the announcement can read them out", () => {
    const announcement = announceWin(
      success({ dora: { dora: 2, redDora: 1, total: 3, uraDora: 0 } }),
    );

    expect(announcement.dora).toEqual({ dora: 2, redDora: 1, total: 3, uraDora: 0 });
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
