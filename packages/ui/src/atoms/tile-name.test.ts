import { describe, expect, it } from "vitest";

import { englishTileWords, isHonourTile, tileName } from "./tile-name";
import type { TileWords } from "./tile-name";

// A screen reader announcing "5 circles" to someone reading the interface in
// Japanese is the gap these words close, so the joining rule matters as much as
// the vocabulary: 五筒 takes no space, "5 circles" does.
const japanese: TileWords = {
  bamboo: "索",
  characters: "萬",
  circles: "筒",
  east: "東",
  green: "發",
  north: "北",
  ranks: ["一", "二", "三", "四", "五", "六", "七", "八", "九"],
  red: "中",
  redFive: "赤五",
  south: "南",
  suited: "{rank}{suit}",
  west: "西",
  white: "白",
};

describe("tileName", () => {
  it("names a numbered tile by its rank and suit", () => {
    expect(tileName("5p")).toBe("5 circles");
    expect(tileName("1m")).toBe("1 characters");
    expect(tileName("9s")).toBe("9 bamboo");
  });

  it("joins rank and suit the way the language joins them", () => {
    expect(tileName("5p", japanese)).toBe("五筒");
    expect(tileName("1m", japanese)).toBe("一萬");
    expect(tileName("9s", japanese)).toBe("九索");
  });

  it("names a red five by what it is, having no number of its own", () => {
    expect(tileName("0p")).toBe("red five circles");
    expect(tileName("0m", japanese)).toBe("赤五萬");
  });

  it("names an honour outright, since it has no rank", () => {
    expect(tileName("east")).toBe("East wind");
    expect(tileName("green")).toBe("Green dragon");
    expect(tileName("east", japanese)).toBe("東");
    expect(tileName("green", japanese)).toBe("發");
  });

  it("falls back to English when an app supplies no words", () => {
    expect(tileName("3s", englishTileWords)).toBe(tileName("3s"));
  });
});

describe("isHonourTile", () => {
  it("separates the tiles that have a rank from the ones that do not", () => {
    expect(isHonourTile("east")).toBe(true);
    expect(isHonourTile("red")).toBe(true);
    expect(isHonourTile("5p")).toBe(false);
    // A red five is a numbered tile despite being called red.
    expect(isHonourTile("0p")).toBe(false);
  });
});
