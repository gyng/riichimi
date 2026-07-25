import { describe, expect, it } from "vitest";
import { combineTileTensors, cropTileTensor } from "./tile-tensor";

describe("tile tensor preprocessing", () => {
  it("crops RGB into normalized channel-first input with contrast expansion", () => {
    const data = new Uint8ClampedArray([
      10, 20, 30, 255, 110, 120, 130, 255, 210, 220, 230, 255, 60, 70, 80, 255,
    ]);
    const tensor = cropTileTensor(
      { data, height: 2, width: 2 },
      { height: 1, width: 1, x: 0, y: 0 },
    );

    expect(tensor).toHaveLength(3 * 64 * 48);
    expect(Math.min(...tensor)).toBeCloseTo(-1);
    expect(Math.max(...tensor)).toBeCloseTo(1);
  });

  it("combines batches and rejects malformed tile tensors", () => {
    const tile = new Float32Array(3 * 64 * 48);
    expect(combineTileTensors([tile, tile])).toHaveLength(tile.length * 2);
    expect(() => combineTileTensors([new Float32Array(2)])).toThrow(RangeError);
  });
});
