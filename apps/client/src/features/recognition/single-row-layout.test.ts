import { locateSingleRowTiles } from "./single-row-layout";
import type { PixelFrame } from "./guided-layout";

// The single-row prototype needs a long canvas: the whole hand, its melds, and the
// dora all sit on one line.
const width = 900;
const height = 200;
const tileWidth = 34;
const tileTop = 70;
const tileBottom = 124;
// A gap comfortably wider than one tile is read as a structural boundary; the
// winning-tile nudge is deliberately kept below it.
const structuralGap = 50;
const winnerNudge = 16;

function blankFrame(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = 25;
    data[index * 4 + 1] = 70;
    data[index * 4 + 2] = 55;
    data[index * 4 + 3] = 255;
  }
  return data;
}

function drawTile(data: Uint8ClampedArray, left: number) {
  for (let y = tileTop; y < tileBottom; y += 1) {
    for (let x = left; x < left + tileWidth; x += 1) {
      const offset = (y * width + x) * 4;
      data[offset] = 242;
      data[offset + 1] = 239;
      data[offset + 2] = 226;
    }
  }
}

// Place `count` touching tiles (pitch 40 → 6px gaps) starting at `start`, optionally
// nudging every tile from `nudgeAt` onward to open the winning-tile gap. Returns the
// right edge of the last tile so callers can chain groups.
function placeRun(data: Uint8ClampedArray, start: number, count: number, nudgeAt = -1): number {
  let right = start;
  for (let index = 0; index < count; index += 1) {
    const left = start + index * 40 + (nudgeAt >= 0 && index >= nudgeAt ? winnerNudge : 0);
    drawTile(data, left);
    right = left + tileWidth;
  }
  return right;
}

function frameOf(data: Uint8ClampedArray): PixelFrame {
  return { data, height, width };
}

describe("locateSingleRowTiles (single-row capture prototype)", () => {
  it("reads a fully concealed hand: one row, winner nudge, dora on the right", () => {
    const data = blankFrame();
    const handRight = placeRun(data, 20, 14, 11);
    drawTile(data, handRight + structuralGap);

    const result = locateSingleRowTiles(frameOf(data));
    if (result.kind !== "success") {
      throw new Error(`Expected a located layout, received: ${result.message}`);
    }
    expect(result.concealed).toHaveLength(14);
    expect(result.melds).toEqual([]);
    expect(result.winningIndex).toBe(11);
    expect(result.winningRoleCertain).toBe(true);
  });

  it("separates a called triplet set well apart to the right of the hand", () => {
    const data = blankFrame();
    const handRight = placeRun(data, 20, 11, 8);
    const meldRight = placeRun(data, handRight + structuralGap, 3);
    drawTile(data, meldRight + structuralGap);

    const result = locateSingleRowTiles(frameOf(data));
    if (result.kind !== "success") {
      throw new Error(`Expected a located layout, received: ${result.message}`);
    }
    expect(result.concealed).toHaveLength(11);
    expect(result.melds).toHaveLength(1);
    expect(result.melds[0]).toHaveLength(3);
  });

  it("reads a four-tile kan as one meld group on the same row", () => {
    const data = blankFrame();
    const handRight = placeRun(data, 20, 10, 7);
    const meldRight = placeRun(data, handRight + structuralGap, 4);
    drawTile(data, meldRight + structuralGap);

    const result = locateSingleRowTiles(frameOf(data));
    if (result.kind !== "success") {
      throw new Error(`Expected a located layout, received: ${result.message}`);
    }
    expect(result.melds).toHaveLength(1);
    expect(result.melds[0]).toHaveLength(4);
  });

  it("requires the row to end in exactly one dora tile", () => {
    const data = blankFrame();
    const handRight = placeRun(data, 20, 14, 11);
    drawTile(data, handRight + structuralGap);
    drawTile(data, handRight + structuralGap + 40);

    expect(locateSingleRowTiles(frameOf(data))).toMatchObject({
      kind: "failure",
      message: expect.stringContaining("one separated dora indicator"),
    });
  });

  it("rejects tiles that stray onto a second line for this one-row layout", () => {
    const data = blankFrame();
    const handRight = placeRun(data, 20, 14, 11);
    drawTile(data, handRight + structuralGap);
    for (let x = 400; x < 434; x += 1) {
      for (let y = 150; y < 190; y += 1) {
        const offset = (y * width + x) * 4;
        data[offset] = 242;
        data[offset + 1] = 239;
        data[offset + 2] = 226;
      }
    }

    expect(locateSingleRowTiles(frameOf(data))).toMatchObject({
      kind: "failure",
      message: expect.stringContaining("one row"),
    });
  });

  // FRAGILITY 1 — the reason the shipping parser keeps melds on their own row. A
  // fully concealed hand whose winner nudge grows to a structural-width gap is
  // silently mis-structured: the trailing three tiles read as a called triplet, an
  // open/closed error that changes han and fu with no failure to warn the user.
  it("silently mis-reads a closed hand as an open one when a hand gap grows too wide", () => {
    const data = blankFrame();
    const bulkRight = placeRun(data, 20, 11);
    const tailRight = placeRun(data, bulkRight + structuralGap, 3);
    drawTile(data, tailRight + structuralGap);

    const result = locateSingleRowTiles(frameOf(data));
    if (result.kind !== "success") {
      throw new Error(`Expected the ambiguous layout to still parse: ${result.message}`);
    }
    // The parse "succeeds" but with the wrong structure: 11 concealed + a phantom
    // triplet, when the truth is 14 concealed tiles.
    expect(result.concealed).toHaveLength(11);
    expect(result.melds).toHaveLength(1);
  });

  // FRAGILITY 2 — the mirror failure. A genuine called meld staged too close to the
  // hand merges into the concealed run and disappears entirely.
  it("silently swallows a called meld staged too close to the concealed hand", () => {
    const data = blankFrame();
    const handRight = placeRun(data, 20, 11);
    const meldRight = placeRun(data, handRight + 22, 3);
    drawTile(data, meldRight + structuralGap);

    const result = locateSingleRowTiles(frameOf(data));
    if (result.kind !== "success") {
      throw new Error(`Expected the merged layout to still parse: ${result.message}`);
    }
    // The called meld vanished into the concealed hand: 14 concealed, no melds.
    expect(result.concealed).toHaveLength(14);
    expect(result.melds).toEqual([]);
  });

  it("rejects malformed pixel buffers", () => {
    expect(() =>
      locateSingleRowTiles({ data: new Uint8ClampedArray(3), height: 1, width: 1 }),
    ).toThrow(RangeError);
  });
});
