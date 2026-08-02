import { describe, expect, it } from "vitest";

import type { WinAnnouncement } from "@riichimi/score-core";
import { announcementLead, announcementTail, announcementText } from "./announcement-text";

const noDora = { dora: 0, redDora: 0, total: 0, uraDora: 0 } as const;

function announcement(overrides: Partial<WinAnnouncement> = {}): WinAnnouncement {
  return {
    dora: noDora,
    fu: 30,
    han: 4,
    headline: [],
    limit: null,
    method: "ron",
    points: 8000,
    ...overrides,
  };
}

describe("announcing a win in Japanese", () => {
  it("reads the method, the yaku, the value, and the points", () => {
    expect(
      announcementText(
        announcement({
          headline: [
            { kana: "ジュンチャン", romaji: "Junchan" },
            { kana: "サンショクドウジュン", romaji: "Sanshoku doujun" },
          ],
        }),
      ).japanese,
    ).toBe("ロン、ジュンチャン、サンショクドウジュン、4ハン30フ、8000テン。");
  });

  it("names the limit after the points, which is the order a table hears it", () => {
    // "12000 — haneman": the number lands, then the word that makes it matter.
    const line = announcementText(
      announcement({
        fu: null,
        han: null,
        headline: [{ kana: "リーチ", romaji: "Riichi" }],
        limit: "haneman",
        method: "tsumo",
        points: 12_000,
      }),
    );

    expect(line.japanese).toBe("ツモ、リーチ、12000テン、ハネマン！");
    expect(line.romaji).toBe("Tsumo. Riichi. 12,000 points. Haneman!");
  });

  it("counts dora the Japanese way, so two dora is 'dora ni'", () => {
    const line = announcementText(
      announcement({ dora: { dora: 2, redDora: 1, total: 3, uraDora: 0 } }),
    );

    expect(line.japanese).toContain("ドラ2");
    expect(line.japanese).toContain("アカドラ1");
    expect(line.romaji).toContain("dora ni");
    expect(line.romaji).toContain("aka dora ichi");
  });

  it("says nothing about dora when there is none", () => {
    expect(announcementText(announcement()).japanese).not.toContain("ドラ");
  });

  it("still announces a hand with no fu breakdown", () => {
    expect(announcementText(announcement({ fu: null, han: 5, points: 12_000 })).japanese).toBe(
      "ロン、5ハン、12000テン。",
    );
  });

  it("splits into a yaku lead and a points-and-limit climax for a synced reveal", () => {
    const yakuman = announcement({
      dora: { dora: 1, redDora: 0, total: 1, uraDora: 0 },
      fu: null,
      han: null,
      headline: [{ kana: "スーアンコー", romaji: "Suuankou" }],
      limit: "yakuman",
      method: "tsumo",
      points: 32_000,
    });

    // The lead carries the build-up, including the dora; the tail lands the
    // points and then the name.
    expect(announcementLead(yakuman).japanese).toBe("ツモ、スーアンコー、ドラ1。");
    expect(announcementTail(yakuman).japanese).toBe("32000テン、ヤクマン！");
    expect(announcementTail(yakuman).romaji).toBe("32,000 points. Yakuman!");
  });

  it("keeps a romanized reading of every line for an engine with no Japanese voice", () => {
    const line = announcementText(
      announcement({
        headline: [{ kana: "メンゼンツモ", romaji: "Menzen tsumo" }],
        method: "tsumo",
      }),
    );

    expect(line.romaji).toBe("Tsumo. Menzen tsumo. 4 han 30 fu. 8,000 points.");
  });
});
