import { describe, expect, it } from "vitest";

import { enumerateStandardDecompositions } from "./decomposition";
import type { CanonicalTileId } from "./tile";

const pinfuHand: readonly CanonicalTileId[] = [
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
];

/**
 * Decomposition is the step that decides which sets a hand contains, so it has
 * to refuse a tile count that cannot form them rather than return a partial
 * reading the scorer would then price.
 */
describe("enumerateStandardDecompositions", () => {
  it("reads a complete concealed hand as four sets and a pair", () => {
    const decompositions = enumerateStandardDecompositions(pinfuHand, 0);

    expect(decompositions.length).toBeGreaterThan(0);
    for (const decomposition of decompositions) {
      expect(decomposition.concealedGroups).toHaveLength(4);
    }
  });

  it("accounts for declared melds when counting the sets still needed", () => {
    // Eleven concealed tiles plus one called set: three sets and a pair remain.
    const concealed: readonly CanonicalTileId[] = [
      "1m",
      "2m",
      "3m",
      "4m",
      "5m",
      "6m",
      "7p",
      "8p",
      "9p",
      "5p",
      "5p",
    ];

    const decompositions = enumerateStandardDecompositions(concealed, 1);

    expect(decompositions.length).toBeGreaterThan(0);
    for (const decomposition of decompositions) {
      expect(decomposition.concealedGroups).toHaveLength(3);
    }
  });

  it("returns nothing when the tile count cannot fill the remaining sets", () => {
    // Thirteen tiles can never be four sets and a pair.
    expect(enumerateStandardDecompositions(pinfuHand.slice(0, 13), 0)).toEqual([]);
    // Two extra tiles cannot either.
    expect(enumerateStandardDecompositions([...pinfuHand, "5p", "5p"], 0)).toEqual([]);
  });

  it("returns nothing when more sets are declared than a hand can hold", () => {
    expect(enumerateStandardDecompositions(["5p", "5p"], 5)).toEqual([]);
  });

  it("returns nothing for tiles that form no sets at all", () => {
    const scattered: readonly CanonicalTileId[] = [
      "1m",
      "4m",
      "7m",
      "1p",
      "4p",
      "7p",
      "1s",
      "4s",
      "7s",
      "east",
      "south",
      "west",
      "north",
      "white",
    ];

    expect(enumerateStandardDecompositions(scattered, 0)).toEqual([]);
  });
});
