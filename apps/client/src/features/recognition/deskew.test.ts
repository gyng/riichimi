import { describe, expect, it } from "vitest";

import { deskewFrame } from "./deskew";
import type { PixelFrame } from "./guided-layout";

/** A row of dark tile faces on a pale table, drawn at a given angle. */
function rowAtAngle(degrees: number): PixelFrame {
  const width = 320;
  const height = 160;
  const data = new Uint8ClampedArray(width * height * 4);
  const slope = Math.tan((degrees * Math.PI) / 180);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const centre = height / 2 + (x - width / 2) * slope;
      const onRow = Math.abs(y - centre) < 26 && x % 26 < 21 && x > 30 && x < width - 30;
      const value = onRow ? 40 : 232;
      const index = (y * width + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return { data, height, width };
}

describe("levelling a photographed row", () => {
  it("leaves a level frame exactly as it found it", () => {
    const frame = rowAtAngle(0);
    const deskewed = deskewFrame(frame);

    // Not merely equivalent: the same object, so a square photo costs no copy.
    expect(deskewed.appliedDegrees).toBeNull();
    expect(deskewed.frame).toBe(frame);
  });

  it("levels a turned frame, and says by how much", () => {
    const deskewed = deskewFrame(rowAtAngle(10));

    expect(deskewed.appliedDegrees).not.toBeNull();
    expect(Math.abs(deskewed.appliedDegrees ?? 0)).toBeGreaterThanOrEqual(8);
  });

  it("grows the canvas rather than cropping the corners off the photo", () => {
    const frame = rowAtAngle(12);
    const deskewed = deskewFrame(frame);

    // A rotation inside the original bounds would cut the ends off the row,
    // which is where the winning tile and the dora sit.
    expect(deskewed.frame.width).toBeGreaterThan(frame.width);
    expect(deskewed.frame.height).toBeGreaterThan(frame.height);
    expect(deskewed.frame.data.length).toBe(deskewed.frame.width * deskewed.frame.height * 4);
  });

  it("puts a box found in the levelled frame back onto the player's photo", () => {
    const deskewed = deskewFrame(rowAtAngle(10));

    // The middle of the levelled frame is the middle of the original: rotation
    // is about the centre, so that point is the one the mapping cannot move.
    const centre = deskewed.toOriginal({ height: 0.02, width: 0.02, x: 0.49, y: 0.49 });
    expect(centre.x + centre.width / 2).toBeCloseTo(0.5, 1);
    expect(centre.y + centre.height / 2).toBeCloseTo(0.5, 1);
  });

  it("maps every box back inside the photo it came from", () => {
    const deskewed = deskewFrame(rowAtAngle(10));

    for (const x of [0.2, 0.5, 0.8]) {
      const mapped = deskewed.toOriginal({ height: 0.15, width: 0.06, x, y: 0.45 });
      expect(mapped.width).toBeGreaterThan(0);
      expect(mapped.height).toBeGreaterThan(0);
      // Upright box around a turned one, so it is at least as large as the tile.
      expect(mapped.width).toBeGreaterThanOrEqual(0.06 * 0.9);
    }
  });

  it("says nothing of a frame too small to measure", () => {
    const tiny: PixelFrame = { data: new Uint8ClampedArray(8 * 8 * 4), height: 8, width: 8 };

    expect(deskewFrame(tiny).appliedDegrees).toBeNull();
  });
});
