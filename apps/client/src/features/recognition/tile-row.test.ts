import { describe, expect, it } from "vitest";

import type { PixelFrame } from "./guided-layout";
import { estimateTileCount, findTileRow, splitTileRow } from "./tile-row";

/**
 * Frames are painted rather than photographed so a test states the situation it
 * cares about: tiles touching, a table lighter than the tiles, a row narrowing
 * with perspective.
 */
interface Paint {
  readonly background: number;
  /** Tile face brightness. May be below the background — a pale table. */
  readonly face: number;
  readonly gap: number;
  readonly height: number;
  /** Widths left to right, so a row can narrow the way perspective narrows it. */
  readonly widths: readonly number[];
  readonly width: number;
}

function paint({ background, face, gap, height, widths, width }: Paint): PixelFrame {
  const data = new Uint8ClampedArray(width * height * 4);
  const set = (x: number, y: number, value: number) => {
    const offset = (y * width + x) * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      set(x, y, background);
    }
  }
  const top = Math.round(height * 0.3);
  const bottom = Math.round(height * 0.75);
  let x = 12;
  for (const tileWidth of widths) {
    for (let ty = top; ty < bottom; ty += 1) {
      for (let tx = x; tx < x + tileWidth; tx += 1) {
        set(tx, ty, face);
      }
    }
    // A glyph: dark strokes inside the face, which must not be read as seams.
    const strokeTop = top + Math.round((bottom - top) * 0.3);
    const strokeBottom = top + Math.round((bottom - top) * 0.7);
    for (const offset of [Math.round(tileWidth * 0.35), Math.round(tileWidth * 0.6)]) {
      for (let ty = strokeTop; ty < strokeBottom; ty += 1) {
        set(x + offset, ty, 10);
        set(x + offset + 1, ty, 10);
      }
    }
    // The seam: a dark column the full height of the tile.
    for (let ty = top; ty < bottom; ty += 1) {
      for (let g = 0; g < gap; g += 1) {
        set(x + tileWidth + g, ty, 18);
      }
    }
    x += tileWidth + gap;
  }
  return { data, height, width };
}

const uniform = (count: number, each: number) => Array.from({ length: count }, () => each);

describe("finding the tile row", () => {
  it("finds tiles on a table darker than they are", () => {
    const frame = paint({
      background: 40,
      face: 210,
      gap: 2,
      height: 120,
      width: 400,
      widths: uniform(10, 34),
    });

    const row = findTileRow(frame);

    expect(row).not.toBeNull();
    expect(row!.top).toBeGreaterThan(20);
    expect(row!.bottom).toBeLessThan(100);
  });

  it("finds tiles on a table lighter than they are", () => {
    // The reason this module exists. A luminance threshold reads a pale table as
    // one enormous tile; on real photographs taken on a white table the old mask
    // matched 46–67% of the frame.
    const frame = paint({
      background: 245,
      face: 200,
      gap: 2,
      height: 120,
      width: 400,
      widths: uniform(10, 34),
    });

    const row = findTileRow(frame);

    expect(row).not.toBeNull();
    expect(row!.bottom - row!.top).toBeGreaterThan(20);
  });
});

describe("splitting a row of touching tiles", () => {
  it("divides a hand whose tiles touch, which the component locator cannot", () => {
    const frame = paint({
      background: 40,
      face: 210,
      gap: 1,
      height: 120,
      width: 500,
      widths: uniform(14, 34),
    });
    const row = findTileRow(frame)!;

    const split = splitTileRow(frame, row, 14);

    expect(split.kind).toBe("success");
    const widths = split.kind === "success" ? split.tiles.map((t) => t.width) : [];
    expect(widths).toHaveLength(14);
    // Every tile close to the same width, so no cut landed mid-tile.
    const largest = Math.max(...widths);
    const smallest = Math.min(...widths);
    expect(largest / smallest).toBeLessThan(1.6);
  });

  it("follows a row that narrows towards its far end", () => {
    // Perspective, which is why the pitch is allowed to drift rather than fixed.
    const frame = paint({
      background: 40,
      face: 210,
      gap: 1,
      height: 120,
      width: 500,
      widths: [44, 42, 40, 38, 36, 34, 32, 30, 28, 26],
    });
    const row = findTileRow(frame)!;

    const split = splitTileRow(frame, row, 10);

    expect(split.kind).toBe("success");
    if (split.kind !== "success") {
      return;
    }
    const widths = split.tiles.map((t) => t.width);
    // The tiles it reports should narrow the same way the row does.
    expect(widths[0]).toBeGreaterThan(widths[widths.length - 1]!);
  });

  it("keeps tiles in reading order and does not overlap them", () => {
    const frame = paint({
      background: 40,
      face: 210,
      gap: 1,
      height: 120,
      width: 500,
      widths: uniform(12, 38),
    });
    const row = findTileRow(frame)!;

    const split = splitTileRow(frame, row, 12);

    expect(split.kind).toBe("success");
    if (split.kind !== "success") {
      return;
    }
    for (let i = 1; i < split.tiles.length; i += 1) {
      const previous = split.tiles[i - 1]!;
      const current = split.tiles[i]!;
      expect(current.x).toBeGreaterThanOrEqual(previous.x + previous.width - 1e-6);
    }
  });

  it("refuses a count the row cannot hold rather than inventing tiles", () => {
    const frame = paint({
      background: 40,
      face: 210,
      gap: 1,
      height: 120,
      width: 500,
      widths: uniform(4, 34),
    });
    const row = findTileRow(frame)!;

    const split = splitTileRow(frame, row, 60);

    expect(split).toMatchObject({
      kind: "failure",
      message: expect.stringMatching(/too small|does not divide/i),
    });
  });

  it("rejects a count that is not a whole number of tiles", () => {
    const frame = paint({
      background: 40,
      face: 210,
      gap: 1,
      height: 120,
      width: 400,
      widths: uniform(8, 40),
    });
    const row = findTileRow(frame)!;

    expect(splitTileRow(frame, row, 0).kind).toBe("failure");
    expect(splitTileRow(frame, row, 2.5).kind).toBe("failure");
  });
});

describe("refusing to read what is not there", () => {
  it("reports no row for a frame too small to hold one", () => {
    const frame = paint({
      background: 40,
      face: 210,
      gap: 0,
      height: 8,
      width: 8,
      widths: [],
    });

    expect(findTileRow(frame)).toBeNull();
  });

  it("reports no row for a blank frame", () => {
    // A flat frame has no edges anywhere, so there is no band to find. Returning
    // a row here would hand the classifier a crop of the table.
    const frame = paint({
      background: 128,
      face: 128,
      gap: 0,
      height: 100,
      width: 300,
      widths: [],
    });

    expect(findTileRow(frame)).toBeNull();
    expect(estimateTileCount(frame)).toBe(0);
  });

  it("returns the whole row when only one tile is expected", () => {
    const frame = paint({
      background: 40,
      face: 210,
      gap: 0,
      height: 120,
      width: 200,
      widths: [120],
    });
    const row = findTileRow(frame)!;

    const split = splitTileRow(frame, row, 1);

    expect(split).toMatchObject({ kind: "success", tiles: expect.objectContaining({ length: 1 }) });
  });
});

describe("counting tiles while the shot is being framed", () => {
  it("counts a row of touching tiles for the capture guide", () => {
    const frame = paint({
      background: 40,
      face: 210,
      gap: 1,
      height: 120,
      width: 500,
      widths: uniform(14, 34),
    });

    // Close enough to steer framing; the guide reports it, it does not gate on it.
    expect(estimateTileCount(frame)).toBeGreaterThanOrEqual(12);
    expect(estimateTileCount(frame)).toBeLessThanOrEqual(16);
  });

  it("counts nothing in an empty frame rather than guessing", () => {
    const frame = paint({
      background: 40,
      face: 40,
      gap: 0,
      height: 120,
      width: 400,
      widths: [],
    });

    expect(estimateTileCount(frame)).toBe(0);
  });
});
