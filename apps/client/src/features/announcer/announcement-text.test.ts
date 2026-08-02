import { describe, expect, it } from "vitest";

import type { WinAnnouncement } from "@riichimi/score-core";
import { announcementBeats, announcementText } from "./announcement-text";

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
    ).toBe("ロン、ジュンチャン、サンショクドウジュン、ヨンハンサンジュウフ、ハッセンテン。");
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

    expect(line.japanese).toBe("ツモ、リーチ、イチマンニセンテン、ハネマン！");
    expect(line.romaji).toBe("Tsumo. Riichi. 12,000 points. Haneman!");
  });

  it("counts dora the Japanese way, so two dora is 'dora ni'", () => {
    const line = announcementText(
      announcement({ dora: { dora: 2, redDora: 1, total: 3, uraDora: 0 } }),
    );

    expect(line.japanese).toContain("ドラニ");
    expect(line.japanese).toContain("アカドライチ");
    expect(line.romaji).toContain("dora ni");
    expect(line.romaji).toContain("aka dora ichi");
  });

  it("says nothing about dora when there is none", () => {
    expect(announcementText(announcement()).japanese).not.toContain("ドラ");
  });

  it("still announces a hand with no fu breakdown", () => {
    expect(announcementText(announcement({ fu: null, han: 5, points: 12_000 })).japanese).toBe(
      "ロン、ゴハン、イチマンニセンテン。",
    );
  });

  it("gives every yaku a beat of its own, so a pause can fall between them", () => {
    const beats = announcementBeats(
      announcement({
        dora: { dora: 1, redDora: 0, total: 1, uraDora: 0 },
        fu: null,
        han: null,
        headline: [
          { kana: "リーチ", romaji: "Riichi" },
          { kana: "スーアンコー", romaji: "Suuankou" },
        ],
        limit: "yakuman",
        method: "tsumo",
        points: 32_000,
      }),
    );

    // Separate utterances, not commas: the caller holds the silence between
    // them, and the last one is the climax the stamp is timed against.
    expect(beats.map((beat) => beat.japanese)).toEqual([
      "ツモ。",
      "リーチ。",
      "スーアンコー。",
      "ドライチ。",
      "サンマンニセンテン、ヤクマン！",
    ]);
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
