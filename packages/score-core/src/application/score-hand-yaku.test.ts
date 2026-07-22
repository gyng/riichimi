import { describe, expect, it } from "vitest";

import type {
  DeclaredMeld,
  ScoreHandInput,
  ScoreHandResult,
  ScoreSuccess,
  ScoringRules,
  TileId,
  WinContext,
} from "../index";
import { scoreHand } from "./score-hand";

const rules = {
  allowOpenTanyao: true,
  countedLimit: "yonbaiman",
  doubleYakuman: false,
  id: "wrc-2025-test",
  kiriageMangan: true,
  label: "WRC 2025",
  redFives: false,
  revision: "2025",
  sourceUrl: "https://www.worldriichi.org/wrc-rules",
} as const satisfies ScoringRules;

const defaultContext = {
  chankan: false,
  firstTurn: "none",
  honba: 0,
  ippatsu: false,
  lastTile: "none",
  method: "ron",
  riichi: "none",
  riichiSticks: 0,
  rinshan: false,
  roundWind: "east",
  seatWind: "south",
} as const satisfies WinContext;

function hand(
  concealedTiles: readonly TileId[],
  winningTile: TileId,
  options: {
    readonly context?: WinContext;
    readonly doraIndicators?: readonly TileId[];
    readonly melds?: readonly DeclaredMeld[];
    readonly rules?: ScoringRules;
    readonly uraDoraIndicators?: readonly TileId[];
  } = {},
): ScoreHandInput {
  return {
    concealedTiles,
    context: options.context ?? defaultContext,
    doraIndicators: options.doraIndicators ?? [],
    melds: options.melds ?? [],
    rules: options.rules ?? rules,
    uraDoraIndicators: options.uraDoraIndicators ?? [],
    winningTile,
  };
}

function success(result: ScoreHandResult): ScoreSuccess {
  expect(result.kind).toBe("success");

  if (result.kind !== "success") {
    throw new Error(`Expected success, received ${result.kind}.`);
  }

  return result;
}

function expectYaku(result: ScoreHandResult, expectedIds: readonly string[]): ScoreSuccess {
  const scored = success(result);
  const ids = scored.yaku.map(({ id }) => id);

  for (const id of expectedIds) {
    expect(ids).toContain(id);
  }

  return scored;
}

function expectYakuman(result: ScoreHandResult, expectedIds: readonly string[]): ScoreSuccess {
  const scored = success(result);
  const ids = scored.yakuman.map(({ id }) => id);

  for (const id of expectedIds) {
    expect(ids).toContain(id);
  }

  return scored;
}

describe("one-han and event yaku", () => {
  it("scores all inside on a closed hand", () => {
    expectYaku(
      scoreHand(
        hand(
          ["2m", "3m", "4m", "3m", "4m", "5m", "4p", "5p", "6p", "6s", "7s", "8s", "5p", "5p"],
          "8s",
        ),
      ),
      ["tanyao"],
    );
  });

  it("respects profiles that forbid open tanyao", () => {
    const result = scoreHand(
      hand(["3m", "4m", "5m", "4p", "5p", "6p", "6s", "7s", "8s", "5p", "5p"], "8s", {
        melds: [{ kind: "sequence", open: true, tiles: ["2m", "3m", "4m"] }],
        rules: { ...rules, allowOpenTanyao: false },
      }),
    );

    expect(result.kind).toBe("no-yaku");
  });

  it("scores one twin sequence", () => {
    expectYaku(
      scoreHand(
        hand(
          ["1m", "2m", "3m", "1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "5p", "5p"],
          "3m",
        ),
      ),
      ["iipeikou"],
    );
  });

  it.each([
    {
      context: { ...defaultContext, riichi: "double-riichi" },
      id: "double-riichi",
    },
    {
      context: { ...defaultContext, ippatsu: true, riichi: "riichi" },
      id: "ippatsu",
    },
    {
      context: { ...defaultContext, chankan: true },
      id: "chankan",
    },
    {
      context: { ...defaultContext, method: "tsumo", rinshan: true },
      id: "rinshan",
    },
    {
      context: { ...defaultContext, lastTile: "haitei", method: "tsumo" },
      id: "haitei",
    },
    {
      context: { ...defaultContext, lastTile: "houtei" },
      id: "houtei",
    },
  ] as const)("scores $id when its event is confirmed", ({ context, id }) => {
    expectYaku(
      scoreHand(
        hand(
          ["1m", "2m", "3m", "4m", "5m", "6m", "7p", "8p", "9p", "2s", "3s", "4s", "5p", "5p"],
          "4s",
          { context },
        ),
      ),
      [id],
    );
  });
});

describe("standard structural yaku", () => {
  it("uses ryanpeikou instead of iipeikou for two twin-sequence pairs", () => {
    const result = expectYaku(
      scoreHand(
        hand(
          ["1m", "2m", "3m", "1m", "2m", "3m", "4p", "5p", "6p", "4p", "5p", "6p", "5s", "5s"],
          "6p",
        ),
      ),
      ["ryanpeikou"],
    );

    expect(result.yaku.map(({ id }) => id)).not.toContain("iipeikou");
  });

  it("scores mixed sequences in all three suits", () => {
    expectYaku(
      scoreHand(
        hand(
          ["1m", "2m", "3m", "1p", "2p", "3p", "1s", "2s", "3s", "4m", "5m", "6m", "5p", "5p"],
          "3s",
        ),
      ),
      ["sanshoku-doujun"],
    );
  });

  it("scores mixed triplets and three concealed triplets", () => {
    expectYaku(
      scoreHand(
        hand(
          ["2m", "2m", "2m", "2p", "2p", "2p", "2s", "2s", "2s", "4m", "5m", "6m", "5p", "5p"],
          "6m",
        ),
      ),
      ["sanshoku-doukou", "sanankou"],
    );
  });

  it("scores all triplets on an open hand", () => {
    expectYaku(
      scoreHand(
        hand(["3m", "3m", "3m", "4p", "4p", "4p", "5s", "5s", "5s", "east", "east"], "east", {
          melds: [{ kind: "triplet", open: true, tile: "2m" }],
        }),
      ),
      ["toitoi", "sanankou"],
    );
  });

  it("scores three quads", () => {
    expectYaku(
      scoreHand(
        hand(["2m", "3m", "4m", "5p", "5p"], "4m", {
          melds: [
            { kind: "quad", open: true, tile: "1s" },
            { kind: "quad", open: true, tile: "9s" },
            { kind: "quad", open: false, tile: "east" },
          ],
        }),
      ),
      ["sankantsu"],
    );
  });

  it("scores common ends when every component uses an end and honours are present", () => {
    expectYaku(
      scoreHand(
        hand(
          ["1m", "2m", "3m", "7m", "8m", "9m", "1p", "1p", "1p", "9s", "9s", "9s", "west", "west"],
          "3m",
        ),
      ),
      ["chanta"],
    );
  });

  it("scores perfect ends without also scoring common ends", () => {
    const result = expectYaku(
      scoreHand(
        hand(
          ["1m", "2m", "3m", "7m", "8m", "9m", "1p", "1p", "1p", "9s", "9s", "9s", "9p", "9p"],
          "3m",
        ),
      ),
      ["junchan"],
    );

    expect(result.yaku.map(({ id }) => id)).not.toContain("chanta");
  });

  it("scores common terminals alongside seven pairs", () => {
    expectYaku(
      scoreHand(
        hand(
          ["1m", "1m", "9m", "9m", "1p", "1p", "9p", "9p", "1s", "1s", "9s", "9s", "east", "east"],
          "east",
        ),
      ),
      ["chiitoitsu", "honroutou"],
    );
  });

  it("scores little dragons plus each dragon value honour", () => {
    expectYaku(
      scoreHand(
        hand(
          [
            "white",
            "white",
            "white",
            "green",
            "green",
            "green",
            "1m",
            "2m",
            "3m",
            "4p",
            "5p",
            "6p",
            "red",
            "red",
          ],
          "red",
        ),
      ),
      ["shousangen", "yakuhai-white", "yakuhai-green"],
    );
  });

  it("scores a common flush", () => {
    expectYaku(
      scoreHand(
        hand(
          [
            "1m",
            "2m",
            "3m",
            "4m",
            "5m",
            "6m",
            "7m",
            "8m",
            "9m",
            "east",
            "east",
            "east",
            "white",
            "white",
          ],
          "9m",
        ),
      ),
      ["honitsu", "ittsuu"],
    );
  });

  it("scores a perfect flush without common flush", () => {
    const result = expectYaku(
      scoreHand(
        hand(
          ["1m", "2m", "3m", "1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "5m", "5m"],
          "9m",
        ),
      ),
      ["chinitsu"],
    );

    expect(result.yaku.map(({ id }) => id)).not.toContain("honitsu");
  });
});

describe("special wins, dora, and yakuman", () => {
  it("scores renhou alone at mangan when it is the best interpretation", () => {
    const result = success(
      scoreHand(
        hand(
          ["1m", "2m", "3m", "4m", "5m", "6m", "7p", "8p", "9p", "2s", "3s", "4s", "5p", "5p"],
          "4s",
          {
            context: {
              ...defaultContext,
              firstTurn: "renhou",
            },
          },
        ),
      ),
    );

    expect(result.yaku.map(({ id }) => id)).toEqual(["renhou"]);
    expect(result.limit).toBe("mangan");
  });

  it("counts wrapped suit, wind, dragon, ura, and red dora", () => {
    const redRules = { ...rules, redFives: true };
    const result = success(
      scoreHand(
        hand(
          [
            "1m",
            "2m",
            "3m",
            "4m",
            "0m",
            "6m",
            "7p",
            "8p",
            "9p",
            "east",
            "east",
            "east",
            "white",
            "white",
          ],
          "6m",
          {
            context: { ...defaultContext, riichi: "riichi" },
            doraIndicators: ["9m", "north", "red"],
            rules: redRules,
            uraDoraIndicators: ["4m"],
          },
        ),
      ),
    );

    expect(result.dora).toEqual({ dora: 6, redDora: 1, total: 8, uraDora: 1 });
  });

  it("does not allow dora to create a yaku", () => {
    const result = scoreHand(
      hand(["2p", "3p", "4p", "4p", "5p", "6p", "6s", "7s", "8s", "5m", "5m"], "8s", {
        doraIndicators: ["4m"],
        melds: [{ kind: "sequence", open: true, tiles: ["1m", "2m", "3m"] }],
      }),
    );

    expect(result.kind).toBe("no-yaku");
  });

  it("scores nine gates", () => {
    expectYakuman(
      scoreHand(
        hand(
          ["1m", "1m", "1m", "2m", "3m", "4m", "5m", "5m", "6m", "7m", "8m", "9m", "9m", "9m"],
          "5m",
        ),
      ),
      ["chuuren-poutou"],
    );
  });

  it("scores all green", () => {
    expectYakuman(
      scoreHand(
        hand(
          ["2s", "2s", "2s", "3s", "3s", "3s", "4s", "4s", "4s", "6s", "6s", "6s", "8s", "8s"],
          "6s",
        ),
      ),
      ["ryuuiisou"],
    );
  });

  it("scores four quads", () => {
    expectYakuman(
      scoreHand(
        hand(["white", "white"], "white", {
          melds: [
            { kind: "quad", open: true, tile: "1m" },
            { kind: "quad", open: true, tile: "2p" },
            { kind: "quad", open: true, tile: "3s" },
            { kind: "quad", open: false, tile: "east" },
          ],
        }),
      ),
      ["suukantsu"],
    );
  });

  it("scores perfect terminals", () => {
    expectYakuman(
      scoreHand(
        hand(["9m", "9m", "9m", "1p", "1p", "1p", "9s", "9s", "9s", "1s", "1s"], "1s", {
          melds: [{ kind: "triplet", open: true, tile: "1m" }],
        }),
      ),
      ["chinroutou"],
    );
  });

  it("scores little winds", () => {
    expectYakuman(
      scoreHand(
        hand(
          [
            "east",
            "east",
            "east",
            "south",
            "south",
            "south",
            "west",
            "west",
            "west",
            "1m",
            "2m",
            "3m",
            "north",
            "north",
          ],
          "north",
        ),
      ),
      ["shousuushii"],
    );
  });

  it("stacks big winds with all honours", () => {
    expectYakuman(
      scoreHand(
        hand(
          [
            "east",
            "east",
            "east",
            "south",
            "south",
            "south",
            "west",
            "west",
            "west",
            "north",
            "north",
            "north",
            "white",
            "white",
          ],
          "white",
        ),
      ),
      ["daisuushii", "tsuuiisou"],
    );
  });

  it("scores chiihou for a non-East first-draw tsumo", () => {
    expectYakuman(
      scoreHand(
        hand(
          ["1m", "2m", "3m", "4m", "5m", "6m", "7p", "8p", "9p", "2s", "3s", "4s", "5p", "5p"],
          "4s",
          {
            context: { ...defaultContext, firstTurn: "chiihou", method: "tsumo" },
          },
        ),
      ),
      ["chiihou"],
    );
  });
});
