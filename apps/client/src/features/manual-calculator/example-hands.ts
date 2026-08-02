import type { RiichiStatus, TileId, Wind, WinMethod } from "@riichimi/score-core";

/**
 * Winning hands to try the calculator with.
 *
 * Built from whole sets rather than random tiles, because a pile of fourteen
 * legal tiles is usually not a winning hand, and a player pressing the button
 * wants a score rather than "not a complete hand". Every recipe here is
 * closed and won by tsumo unless it carries its own yaku, so menzen tsumo
 * guarantees the hand scores something.
 *
 * Weights make the ordinary ordinary. A yakuman on the third press would be a
 * lie about how the game plays, and the point of pressing repeatedly is to see
 * the spread — mostly small hands, occasionally something worth shouting about.
 */

export interface ExampleHand {
  readonly concealed: readonly TileId[];
  readonly doraIndicators: readonly TileId[];
  /** What the hand is, in plain words, for whoever pressed the button. */
  readonly label: string;
  readonly method: WinMethod;
  readonly riichi: RiichiStatus;
  readonly roundWind: Wind;
  readonly seatWind: Wind;
  readonly winningIndex: number;
}

type Random = () => number;

const SUITS = ["m", "p", "s"] as const;
const HONOURS: readonly TileId[] = ["east", "south", "west", "north", "white", "green", "red"];
const DRAGONS: readonly TileId[] = ["white", "green", "red"];
const WINDS: readonly Wind[] = ["east", "south", "west", "north"];
const TERMINALS: readonly TileId[] = [
  "1m",
  "9m",
  "1p",
  "9p",
  "1s",
  "9s",
  "east",
  "south",
  "west",
  "north",
  "white",
  "green",
  "red",
];

/**
 * Looked up rather than composed, so no assertion is needed to convince the
 * compiler that a built string is a real tile.
 */
const SUITED: Record<(typeof SUITS)[number], readonly TileId[]> = {
  m: ["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m"],
  p: ["1p", "2p", "3p", "4p", "5p", "6p", "7p", "8p", "9p"],
  s: ["1s", "2s", "3s", "4s", "5s", "6s", "7s", "8s", "9s"],
};

function suited(rank: number, suit: (typeof SUITS)[number]): TileId {
  const tile = SUITED[suit][Math.min(9, Math.max(1, rank)) - 1];
  if (tile === undefined) {
    throw new RangeError(`No tile at rank ${rank} of ${suit}.`);
  }
  return tile;
}

function pick<T>(random: Random, values: readonly T[]): T {
  const index = Math.min(values.length - 1, Math.floor(random() * values.length));
  const value = values[index];
  if (value === undefined) {
    throw new RangeError("Cannot pick from an empty set of values.");
  }
  return value;
}

const between = (random: Random, low: number, high: number): number =>
  low + Math.floor(random() * (high - low + 1));

/** A tile may appear four times in a set of tiles, and no more. */
function fits(counts: Map<TileId, number>, tiles: readonly TileId[]): boolean {
  const draft = new Map(counts);
  for (const tile of tiles) {
    const next = (draft.get(tile) ?? 0) + 1;
    if (next > 4) {
      return false;
    }
    draft.set(tile, next);
  }
  return true;
}

function take(counts: Map<TileId, number>, tiles: readonly TileId[]): void {
  for (const tile of tiles) {
    counts.set(tile, (counts.get(tile) ?? 0) + 1);
  }
}

/** A run or a triplet the inventory can still supply, or null after enough tries. */
function drawSet(
  random: Random,
  counts: Map<TileId, number>,
  options: { readonly runsOnly?: boolean; readonly suits?: readonly (typeof SUITS)[number][] },
): readonly TileId[] | null {
  const suits = options.suits ?? SUITS;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const wantRun = options.runsOnly === true || random() < 0.6;
    const suit = pick(random, suits);
    const candidate = wantRun
      ? (() => {
          const start = between(random, 1, 7);
          return [suited(start, suit), suited(start + 1, suit), suited(start + 2, suit)];
        })()
      : (() => {
          const rank = between(random, 1, 9);
          const tile = suited(rank, suit);
          return [tile, tile, tile];
        })();
    if (fits(counts, candidate)) {
      take(counts, candidate);
      return candidate;
    }
  }
  return null;
}

function drawPair(
  random: Random,
  counts: Map<TileId, number>,
  from: readonly TileId[],
): readonly TileId[] | null {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const tile = pick(random, from);
    if (fits(counts, [tile, tile])) {
      take(counts, [tile, tile]);
      return [tile, tile];
    }
  }
  return null;
}

const ALL_SUITED: readonly TileId[] = SUITS.flatMap((suit) =>
  Array.from({ length: 9 }, (_, index) => suited(index + 1, suit)),
);
const SIMPLES: readonly TileId[] = SUITS.flatMap((suit) =>
  Array.from({ length: 7 }, (_, index) => suited(index + 2, suit)),
);

/** Four sets and a pair, drawn under the four-copy limit. */
function standard(
  random: Random,
  options: {
    readonly pairFrom?: readonly TileId[];
    readonly runsOnly?: boolean;
    readonly suits?: readonly (typeof SUITS)[number][];
  } = {},
): readonly TileId[] | null {
  const counts = new Map<TileId, number>();
  const tiles: TileId[] = [];
  for (let index = 0; index < 4; index += 1) {
    const set = drawSet(random, counts, options);
    if (set === null) {
      return null;
    }
    tiles.push(...set);
  }
  const pair = drawPair(random, counts, options.pairFrom ?? ALL_SUITED);
  if (pair === null) {
    return null;
  }
  tiles.push(...pair);
  return tiles;
}

interface Recipe {
  readonly build: (random: Random) => Omit<ExampleHand, "doraIndicators" | "roundWind"> | null;
  readonly weight: number;
}

const base = (
  concealed: readonly TileId[],
  label: string,
  random: Random,
  overrides: Partial<ExampleHand> = {},
): Omit<ExampleHand, "doraIndicators" | "roundWind"> => ({
  concealed,
  label,
  method: overrides.method ?? "tsumo",
  riichi: overrides.riichi ?? (random() < 0.35 ? "riichi" : "none"),
  seatWind: overrides.seatWind ?? pick(random, WINDS),
  // Winning on the last tile of the hand is the common shape and keeps the
  // winning-tile marker somewhere a player can see it.
  winningIndex: overrides.winningIndex ?? concealed.length - 1,
});

const RECIPES: readonly Recipe[] = [
  {
    build: (random) => {
      const tiles = standard(random);
      return tiles === null ? null : base(tiles, "A closed hand", random);
    },
    weight: 38,
  },
  {
    build: (random) => {
      const tiles = standard(random, { pairFrom: SIMPLES, suits: SUITS });
      if (tiles === null || tiles.some((tile) => !SIMPLES.includes(tile))) {
        return null;
      }
      return base(tiles, "All simples", random);
    },
    weight: 12,
  },
  {
    build: (random) => {
      const tiles = standard(random, { pairFrom: SIMPLES, runsOnly: true });
      // Won by self-draw: a closed all-runs hand only has pinfu when the wait
      // is two-sided too, which this does not arrange, and ron would then leave
      // it with no yaku at all.
      return tiles === null ? null : base(tiles, "All runs", random);
    },
    weight: 10,
  },
  {
    build: (random) => {
      // Seven pairs: seven distinct tiles, each twice.
      const pool = [...ALL_SUITED, ...HONOURS];
      const chosen: TileId[] = [];
      for (let attempt = 0; attempt < 200 && chosen.length < 7; attempt += 1) {
        const tile = pick(random, pool);
        if (!chosen.includes(tile)) {
          chosen.push(tile);
        }
      }
      if (chosen.length < 7) {
        return null;
      }
      return base(
        chosen.flatMap((tile) => [tile, tile]),
        "Seven pairs",
        random,
      );
    },
    weight: 8,
  },
  {
    build: (random) => {
      const suit = pick(random, SUITS);
      const counts = new Map<TileId, number>();
      const tiles: TileId[] = [];
      // One suit plus honours: three suited sets, one honour triplet, honour pair.
      for (let index = 0; index < 3; index += 1) {
        const set = drawSet(random, counts, { suits: [suit] });
        if (set === null) {
          return null;
        }
        tiles.push(...set);
      }
      const honour = pick(random, HONOURS);
      if (!fits(counts, [honour, honour, honour])) {
        return null;
      }
      take(counts, [honour, honour, honour]);
      tiles.push(honour, honour, honour);
      const pair = drawPair(random, counts, HONOURS);
      if (pair === null) {
        return null;
      }
      tiles.push(...pair);
      return base(tiles, "Half flush", random);
    },
    weight: 9,
  },
  {
    build: (random) => {
      const suit = pick(random, SUITS);
      const tiles = standard(random, { suits: [suit] });
      if (tiles === null) {
        return null;
      }
      const onlySuit = Array.from({ length: 9 }, (_, index) => suited(index + 1, suit));
      return tiles.every((tile) => onlySuit.includes(tile))
        ? base(tiles, "Full flush", random)
        : null;
    },
    weight: 5,
  },
  {
    build: (random) => {
      const counts = new Map<TileId, number>();
      const tiles: TileId[] = [];
      for (let index = 0; index < 4; index += 1) {
        const rank = between(random, 1, 9);
        const tile = suited(rank, pick(random, SUITS));
        if (!fits(counts, [tile, tile, tile])) {
          return null;
        }
        take(counts, [tile, tile, tile]);
        tiles.push(tile, tile, tile);
      }
      const pair = drawPair(random, counts, ALL_SUITED);
      return pair === null ? null : base([...tiles, ...pair], "All triplets", random);
    },
    weight: 7,
  },
  {
    build: (random) => {
      const dragon = pick(random, DRAGONS);
      const counts = new Map<TileId, number>([[dragon, 3]]);
      const tiles: TileId[] = [dragon, dragon, dragon];
      for (let index = 0; index < 3; index += 1) {
        const set = drawSet(random, counts, {});
        if (set === null) {
          return null;
        }
        tiles.push(...set);
      }
      const pair = drawPair(random, counts, ALL_SUITED);
      return pair === null ? null : base([...tiles, ...pair], "A dragon triplet", random);
    },
    weight: 7,
  },
  {
    build: (random) => {
      // Thirteen orphans: one of each terminal and honour, plus a second of one.
      const extra = pick(random, TERMINALS);
      return base([...TERMINALS, extra], "Thirteen orphans", random, { riichi: "none" });
    },
    weight: 1.5,
  },
  {
    build: (random) => {
      const counts = new Map<TileId, number>();
      const tiles: TileId[] = [];
      for (let index = 0; index < 4; index += 1) {
        let placed = false;
        for (let attempt = 0; attempt < 40 && !placed; attempt += 1) {
          const tile = suited(between(random, 1, 9), pick(random, SUITS));
          if (fits(counts, [tile, tile, tile])) {
            take(counts, [tile, tile, tile]);
            tiles.push(tile, tile, tile);
            placed = true;
          }
        }
        if (!placed) {
          return null;
        }
      }
      const pair = drawPair(random, counts, ALL_SUITED);
      // Four concealed triplets needs the win to be a self-draw.
      return pair === null
        ? null
        : base([...tiles, ...pair], "Four concealed triplets", random, {
            method: "tsumo",
            riichi: "none",
          });
    },
    weight: 1.2,
  },
  {
    build: (random) => {
      const counts = new Map<TileId, number>([
        ["white", 3],
        ["green", 3],
        ["red", 3],
      ]);
      const tiles: TileId[] = [
        "white",
        "white",
        "white",
        "green",
        "green",
        "green",
        "red",
        "red",
        "red",
      ];
      const set = drawSet(random, counts, {});
      if (set === null) {
        return null;
      }
      tiles.push(...set);
      const pair = drawPair(random, counts, ALL_SUITED);
      return pair === null
        ? null
        : base([...tiles, ...pair], "Big three dragons", random, { riichi: "none" });
    },
    weight: 0.8,
  },
  {
    build: (random) => {
      const suit = pick(random, SUITS);
      const one = suited(1, suit);
      const nine = suited(9, suit);
      const middle = Array.from({ length: 7 }, (_, index) => suited(index + 2, suit));
      const doubled = pick(random, [one, nine, ...middle]);
      return base([one, one, one, ...middle, nine, nine, nine, doubled], "Nine gates", random, {
        riichi: "none",
      });
    },
    weight: 0.5,
  },
];

const TOTAL_WEIGHT = RECIPES.reduce((sum, recipe) => sum + recipe.weight, 0);

/**
 * A dora indicator comes off the same wall as the hand, so it cannot be a tile
 * the hand has already used four times.
 */
function drawIndicator(random: Random, concealed: readonly TileId[]): TileId | null {
  const counts = new Map<TileId, number>();
  take(counts, concealed);
  const pool = [...ALL_SUITED, ...HONOURS];
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const tile = pick(random, pool);
    if (fits(counts, [tile])) {
      return tile;
    }
  }
  return null;
}

/**
 * Pick a hand, weighted, and give it a round and some dora.
 *
 * Falls back to a plain closed hand if a recipe cannot be satisfied under the
 * four-copy limit, so the button always produces something that scores.
 */
export function randomExampleHand(random: Random = Math.random): ExampleHand {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    let target = random() * TOTAL_WEIGHT;
    const recipe =
      RECIPES.find((candidate) => {
        target -= candidate.weight;
        return target <= 0;
      }) ?? RECIPES[0];
    const built = recipe?.build(random);
    if (built === undefined || built === null) {
      continue;
    }
    if (built.concealed.length !== 14) {
      continue;
    }
    const indicator = drawIndicator(random, built.concealed);
    if (indicator === null) {
      continue;
    }
    return {
      ...built,
      doraIndicators: [indicator],
      roundWind: pick(random, WINDS),
    };
  }
  return workedExample();
}

/**
 * The one fixed hand: 2 han, 20 fu, pinfu tsumo.
 *
 * Kept deterministic for the WebMCP tool and the browser dogfood, which need a
 * hand whose score they can assert. A person pressing the button wants variety;
 * an agent asking for "the example" wants the same one every time.
 */
export function workedExample(): ExampleHand {
  return {
    concealed: ["1m", "2m", "3m", "4m", "5m", "6m", "7p", "8p", "9p", "2s", "3s", "4s", "5p", "5p"],
    doraIndicators: ["9s"],
    label: "A closed hand",
    method: "tsumo",
    riichi: "none",
    roundWind: "east",
    seatWind: "south",
    winningIndex: 11,
  };
}
