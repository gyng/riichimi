import { locateGuidedTiles } from "./guided-layout";
import type { PixelFrame } from "./guided-layout";

function frame(tileCount = 14, doraCount = 1): PixelFrame {
  const width = 620;
  const height = 260;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = 25;
    data[index * 4 + 1] = 70;
    data[index * 4 + 2] = 55;
    data[index * 4 + 3] = 255;
  }
  function rectangle(left: number, top: number, right: number, bottom: number) {
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const offset = (y * width + x) * 4;
        data[offset] = 242;
        data[offset + 1] = 239;
        data[offset + 2] = 226;
      }
    }
  }
  for (let index = 0; index < tileCount; index += 1) {
    const winningGap = index >= 11 ? 16 : 0;
    const left = 16 + index * 41 + winningGap;
    rectangle(left, 42, left + 34, 96);
  }
  for (let index = 0; index < doraCount; index += 1) {
    const left = 500 + index * 48;
    rectangle(left, 150, left + 34, 204);
  }
  return { data, height, width };
}

describe("locateGuidedTiles", () => {
  it("finds a 14-tile row, its deliberately separated winner, and the dora indicator", () => {
    const result = locateGuidedTiles(frame());

    expect(result).toMatchObject({
      hand: expect.arrayContaining([expect.objectContaining({ height: expect.any(Number) })]),
      kind: "success",
      winningIndex: 11,
      winningRoleCertain: true,
    });
    if (result.kind !== "success") {
      throw new Error("Expected the guided layout to be found.");
    }
    expect(result.hand).toHaveLength(14);
    expect(result.dora.y).toBeGreaterThan(result.hand[0]?.y ?? 0);
  });

  it("fails with capture guidance instead of inventing missing tiles", () => {
    expect(locateGuidedTiles(frame(9, 0))).toEqual({
      foundTileFaces: 9,
      kind: "failure",
      message: "Found 9 tile-like faces, but the guided row needs exactly 14 separated tiles.",
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
