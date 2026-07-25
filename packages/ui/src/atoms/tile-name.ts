import type { TileId } from "@riichimi/score-core";

/**
 * The words a tile is named with. Supplied by the app so a tile can be announced
 * in the reader's own language: a screen reader should say 五筒, not "5 circles",
 * to someone reading the interface in Japanese.
 */
export interface TileWords {
  readonly bamboo: string;
  readonly characters: string;
  readonly circles: string;
  readonly east: string;
  readonly green: string;
  readonly north: string;
  /** The nine rank words, 1 through 9. */
  readonly ranks: readonly [string, string, string, string, string, string, string, string, string];
  readonly red: string;
  /** The rank word for a red five, which has no number of its own. */
  readonly redFive: string;
  readonly south: string;
  /** How a rank joins its suit. English needs the space; 五筒 does not. */
  readonly suited: string;
  readonly west: string;
  readonly white: string;
}

/** The names the package falls back to when an app supplies none. */
export const englishTileWords: TileWords = {
  bamboo: "bamboo",
  characters: "characters",
  circles: "circles",
  east: "East wind",
  green: "Green dragon",
  north: "North wind",
  ranks: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
  red: "Red dragon",
  redFive: "red five",
  south: "South wind",
  suited: "{rank} {suit}",
  west: "West wind",
  white: "White dragon",
};

const HONOURS = ["east", "south", "west", "north", "white", "green", "red"] as const;

type HonourTile = (typeof HONOURS)[number];

/** An honour has no rank, so it is named outright and has no corner shorthand. */
export function isHonourTile(tile: TileId): tile is HonourTile {
  return (HONOURS as readonly string[]).includes(tile);
}

/**
 * What to call a tile out loud. Honours are named outright; a numbered tile is its
 * rank and its suit, joined the way the language joins them.
 */
export function tileName(tile: TileId, words: TileWords = englishTileWords): string {
  if (isHonourTile(tile)) {
    return words[tile];
  }

  const suit = tile.endsWith("m")
    ? words.characters
    : tile.endsWith("p")
      ? words.circles
      : words.bamboo;
  // A red five is written "0m"/"0p"/"0s": rank zero, because it replaces a five.
  const rank = tile.startsWith("0") ? words.redFive : (words.ranks[Number(tile[0]) - 1] ?? tile[0]);
  return words.suited.replace("{rank}", rank ?? "").replace("{suit}", suit);
}
