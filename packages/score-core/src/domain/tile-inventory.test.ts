import { describe, expect, it } from "vitest";

import { auditTileInventory } from "./tile-inventory";

describe("auditTileInventory", () => {
  it("counts a red five as the same physical tile kind as a normal five", () => {
    const audit = auditTileInventory(["5m", "5m", "5m", "0m"]);

    expect(audit.counts["5m"]).toBe(4);
    expect(audit.issues).toEqual([]);
  });

  it("reports an impossible fifth physical copy", () => {
    const audit = auditTileInventory(["5p", "5p", "5p", "5p", "0p"]);

    expect(audit.issues).toEqual([{ actual: 5, code: "TOO_MANY_COPIES", maximum: 4, tile: "5p" }]);
  });

  it("does not mutate the supplied tile sequence", () => {
    const tiles = ["east", "east", "south"] as const;

    auditTileInventory(tiles);

    expect(tiles).toEqual(["east", "east", "south"]);
  });
});
