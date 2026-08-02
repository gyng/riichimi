import { describe, expect, it } from "vitest";

import { fuCatalog, groupFuCatalog } from "./fu-catalog";
import { scoreHand } from "../application/score-hand";
import type { ScoreHandInput } from "./hand";
import type { TileId } from "./tile";
import { yakuCatalog, yakuReference, yakumanCatalog, yakumanReference } from "./yaku-catalog";

const rules = {
  allowOpenTanyao: true,
  countedLimit: "yonbaiman",
  doubleWindPairFu: 4,
  doubleYakuman: false,
  id: "test",
  kiriageMangan: false,
  label: "Test",
  maxYakumanMultiple: null,
  redFives: true,
  revision: "test",
  sourceUrl: "https://example.invalid",
  uraDora: true,
  yakumanStacking: "additive",
} as const;

function score(concealedTiles: readonly TileId[], winningTile: TileId, method: "ron" | "tsumo") {
  return scoreHand({
    concealedTiles,
    context: {
      chankan: false,
      firstTurn: "none",
      honba: 0,
      ippatsu: false,
      lastTile: "none",
      method,
      riichi: "none",
      riichiSticks: 0,
      rinshan: false,
      roundWind: "east",
      seatWind: "south",
    },
    doraIndicators: ["9m"],
    melds: [],
    rules,
    uraDoraIndicators: [],
    winningTile,
  } satisfies ScoreHandInput);
}

describe("the yaku catalogue", () => {
  it("gives every entry a distinct id", () => {
    const ids = [...yakuCatalog, ...yakumanCatalog].map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names each yaku the way the scorer names it", () => {
    // The whole point of the catalogue: a player reading the reference and a
    // player reading their own audit are reading the same words. If these ever
    // part, one of the two screens is lying.
    const scored = score(
      ["2m", "3m", "4m", "3p", "4p", "5p", "6s", "7s", "8s", "2m", "3m", "4m", "5s", "5s"],
      "5s",
      "tsumo",
    );
    expect(scored.kind).toBe("success");
    if (scored.kind !== "success") {
      return;
    }

    for (const awarded of scored.yaku) {
      const entry = yakuCatalog.find((candidate) => candidate.id === awarded.id);
      expect(entry, `no catalogue entry for ${awarded.id}`).toBeDefined();
      expect(awarded.name).toBe(entry?.name);
      expect(awarded.japanese).toBe(entry?.japanese);
      expect(awarded.romanized).toBe(entry?.romanized);
    }
  });

  it("states the han a closed hand actually earns", () => {
    // Seven pairs and twin sequences read 2 and 1 in the catalogue; a hand that
    // scores them has to agree, or the reference is teaching the wrong number.
    const scored = score(
      ["2m", "2m", "5m", "5m", "8m", "8m", "2p", "2p", "6p", "6p", "3s", "3s", "7s", "7s"],
      "7s",
      "ron",
    );
    expect(scored.kind).toBe("success");
    if (scored.kind !== "success") {
      return;
    }

    const sevenPairs = scored.yaku.find((entry) => entry.id === "chiitoitsu");
    expect(sevenPairs?.han).toBe(yakuCatalog.find((entry) => entry.id === "chiitoitsu")?.closedHan);
  });

  it("refuses to name a yaku it has never heard of", () => {
    // What makes the agreement above structural rather than hopeful: the
    // scorer builds every yaku through this lookup, so an id added to the
    // detector and forgotten here cannot reach a score panel.
    expect(() => yakuReference("not-a-yaku")).toThrow("No catalogue entry for yaku not-a-yaku.");
    expect(() => yakumanReference("not-a-yakuman")).toThrow(
      "No catalogue entry for yakuman not-a-yakuman.",
    );
  });

  it("tells a reader what each hand has to look like", () => {
    for (const entry of [...yakuCatalog, ...yakumanCatalog]) {
      expect(entry.requirement, `${entry.id} has no requirement`).not.toBe("");
    }
  });
});

describe("the fu catalogue", () => {
  it("uses the wording the scorer puts in its audit", () => {
    // A self-draw on a lone-pair wait with a terminal triplet: four different
    // rows of the table in one hand.
    const scored = score(
      ["1m", "1m", "1m", "2p", "3p", "4p", "6p", "7p", "8p", "3s", "4s", "5s", "9s", "9s"],
      "9s",
      "tsumo",
    );
    expect(scored.kind).toBe("success");
    if (scored.kind !== "success") {
      return;
    }

    const known = new Set([
      ...fuCatalog.map((entry) => entry.reason),
      ...groupFuCatalog.map((entry) => entry.reason),
    ]);
    expect(scored.fu).not.toBeNull();
    for (const item of scored.fu?.items ?? []) {
      expect(known, `${item.reason} is not in the fu reference`).toContain(item.reason);
      const row = groupFuCatalog.find((entry) => entry.reason === item.reason);
      expect(row?.fu ?? item.fu).toBe(item.fu);
    }
  });
});
