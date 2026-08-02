import { describe, expect, it } from "vitest";
import { locateGuidedTiles } from "./guided-layout";
import type { PixelFrame } from "./guided-layout";

const width = 620;
const height = 260;

function blankFrame(): { data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = 25;
    data[index * 4 + 1] = 70;
    data[index * 4 + 2] = 55;
    data[index * 4 + 3] = 255;
  }
  return { data };
}

function drawRectangle(
  data: Uint8ClampedArray,
  left: number,
  top: number,
  right: number,
  bottom: number,
) {
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * width + x) * 4;
      data[offset] = 242;
      data[offset + 1] = 239;
      data[offset + 2] = 226;
    }
  }
}

// A closed hand: `tileCount` concealed tiles on top (with a winning gap after the
// 11th) and `doraCount` indicators below.
function frame(tileCount = 14, doraCount = 1): PixelFrame {
  const { data } = blankFrame();
  for (let index = 0; index < tileCount; index += 1) {
    const winningGap = index >= 11 ? 16 : 0;
    const left = 16 + index * 41 + winningGap;
    drawRectangle(data, left, 42, left + 34, 96);
  }
  for (let index = 0; index < doraCount; index += 1) {
    const left = 500 + index * 48;
    drawRectangle(data, left, 150, left + 34, 204);
  }
  return { data, height, width };
}

// A hand with one called meld: concealed tiles on top, a meld group of
// `meldSize` tiles on a middle row, and one dora below.
function frameWithMeld(concealedCount: number, meldSize: number): PixelFrame {
  const { data } = blankFrame();
  for (let index = 0; index < concealedCount; index += 1) {
    const winningGap = index >= concealedCount - 3 ? 16 : 0;
    const left = 16 + index * 41 + winningGap;
    drawRectangle(data, left, 24, left + 34, 78);
  }
  for (let index = 0; index < meldSize; index += 1) {
    const left = 30 + index * 36;
    drawRectangle(data, left, 104, left + 34, 158);
  }
  drawRectangle(data, 300, 184, 334, 238);
  return { data, height, width };
}

describe("locateGuidedTiles", () => {
  it("finds a 14-tile row, its deliberately separated winner, and the dora indicator", () => {
    const result = locateGuidedTiles(frame());

    expect(result).toMatchObject({
      concealed: expect.arrayContaining([expect.objectContaining({ height: expect.any(Number) })]),
      kind: "success",
      melds: [],
      winningIndex: 11,
      winningRoleCertain: true,
    });
    if (result.kind !== "success") {
      throw new Error("Expected the guided layout to be found.");
    }
    expect(result.concealed).toHaveLength(14);
    expect(result.dora.y).toBeGreaterThan(result.concealed[0]?.y ?? 0);
  });

  it("separates a called triplet meld from the concealed hand", () => {
    const result = locateGuidedTiles(frameWithMeld(11, 3));
    if (result.kind !== "success") {
      throw new Error(`Expected a located layout, received: ${result.message}`);
    }
    expect(result.concealed).toHaveLength(11);
    expect(result.melds).toHaveLength(1);
    expect(result.melds[0]).toHaveLength(3);
  });

  it("reads a four-tile kan as one meld group", () => {
    const result = locateGuidedTiles(frameWithMeld(10, 4));
    if (result.kind !== "success") {
      throw new Error(`Expected a located layout, received: ${result.message}`);
    }
    expect(result.melds).toHaveLength(1);
    expect(result.melds[0]).toHaveLength(4);
  });

  it("rejects a meld group that is not 3 or 4 tiles", () => {
    expect(locateGuidedTiles(frameWithMeld(11, 2))).toMatchObject({
      kind: "failure",
      message: expect.stringContaining("3 tiles (chi/pon) or 4"),
    });
  });

  it("fails with capture guidance instead of inventing missing tiles", () => {
    expect(locateGuidedTiles(frame(9, 0))).toMatchObject({
      foundTileFaces: 9,
      kind: "failure",
      message: expect.stringContaining("dora indicator below"),
    });
  });

  it("rejects extra tile-like faces instead of guessing which one is dora", () => {
    expect(locateGuidedTiles(frame(14, 2))).toMatchObject({
      foundTileFaces: 16,
      kind: "failure",
      message: expect.stringContaining("exactly one separated dora indicator"),
    });
  });

  it("rejects malformed pixel buffers", () => {
    expect(() =>
      locateGuidedTiles({ data: new Uint8ClampedArray(3), height: 1, width: 1 }),
    ).toThrow(RangeError);
  });
});

/**
 * A revealed hand as it actually sits on the table: fourteen tiles pushed
 * together, with a dora indicator below. Connected components sees one wide
 * region, not fourteen tiles.
 */
function touchingHandFrame(): PixelFrame {
  const { data } = blankFrame();
  for (let index = 0; index < 14; index += 1) {
    const left = 16 + index * 38;
    drawRectangle(data, left, 42, left + 37, 96);
    // The seam: a dark line the full height of the tile, which is all that
    // distinguishes one face from the next when they touch.
    for (let y = 42; y < 96; y += 1) {
      const offset = (y * width + left + 37) * 4;
      data[offset] = 30;
      data[offset + 1] = 28;
      data[offset + 2] = 26;
    }
  }
  drawRectangle(data, 300, 150, 334, 204);
  return { data, height, width };
}

describe("a hand whose tiles are touching", () => {
  it("reads fourteen tiles from a row with no gaps between them", () => {
    // The most natural way to present a winning hand, and the one the
    // gap-finding locator cannot read at all.
    const layout = locateGuidedTiles(touchingHandFrame());

    expect(layout.kind).toBe("success");
    if (layout.kind !== "success") {
      return;
    }
    expect(layout.concealed).toHaveLength(14);
    for (let index = 1; index < layout.concealed.length; index += 1) {
      const previous = layout.concealed[index - 1]!;
      const current = layout.concealed[index]!;
      expect(current.x).toBeGreaterThan(previous.x);
    }
  });

  it("does not claim to know the winning tile when there is no gap to read it from", () => {
    // Spacing is what marks the winning tile, and a divided row has none. The
    // review desk asks rather than guessing.
    const layout = locateGuidedTiles(touchingHandFrame());

    expect(layout).toMatchObject({ kind: "success", winningRoleCertain: false });
  });
});
