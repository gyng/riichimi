import { describe, expect, it } from "vitest";

import { drawingBufferSize } from "./celebration-overlay";

/**
 * The fire is a full-screen fragment shader, so its cost per frame is exactly
 * the buffer's area. Getting this wrong is not a visual defect but a missing
 * feature: too many pixels, the frame budget blows, and the celebration bails.
 */
describe("sizing the celebration's drawing buffer", () => {
  it("draws a phone at its native resolution, where there is room to", () => {
    // 390 x 844 at 2x is well inside the budget and should not be scaled down.
    expect(drawingBufferSize(390, 844, 2)).toEqual({ height: 1688, width: 780 });
  });

  it("caps a desk, where native resolution is millions of fragments a frame", () => {
    const { height, width } = drawingBufferSize(1512, 900, 2);

    expect(width * height).toBeLessThanOrEqual(1_400_000);
    // Still the same shape, so the effect is scaled rather than cropped.
    expect(width / height).toBeCloseTo(1512 / 900, 2);
  });

  it("caps a 4K display too, which is where this bites hardest", () => {
    const { height, width } = drawingBufferSize(3840, 2160, 2);

    expect(width * height).toBeLessThanOrEqual(1_400_000);
    expect(width).toBeGreaterThan(0);
  });

  it("never asks for a zero-sized buffer, which WebGL rejects", () => {
    expect(drawingBufferSize(0, 0, 1)).toEqual({ height: 1, width: 1 });
  });
});
