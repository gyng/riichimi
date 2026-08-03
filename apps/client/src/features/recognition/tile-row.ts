import type { NormalizedBounds } from "@riichimi/vision";

import type { PixelFrame } from "./guided-layout";

/**
 * Reading a row of tiles that are touching.
 *
 * The connected-component locator in `guided-layout` needs every tile to stand
 * clear of its neighbours, because two touching faces are one bright region to
 * it. That asks a player to spread a winning hand out after revealing it, which
 * is real work at the table and the most common reason a capture fails.
 *
 * It is also unnecessary. The guide already tells a player how many tiles to
 * lay out, so the count is known, and a row of a known count can be divided
 * without any gaps to find.
 *
 * Two things make that work:
 *
 * - **The row is found by structure, not brightness.** A tile face carries
 *   glyphs and meets its neighbours at seams, so it is dense with edges; a
 *   table is smooth whether it is dark felt or pale wood. Thresholding on
 *   luminance instead — as the component locator does at `>= 125` — reads a
 *   white table as one enormous tile, which measured 46–67% of the frame on
 *   real photographs taken on one.
 * - **A seam is scored by the brightest pixel in its column, not the average.**
 *   A seam is dark the whole way down a tile; the vertical strokes of a glyph
 *   like 萬 are darker still but have bright face above and below them. Scoring
 *   average darkness picks the strokes and cuts tiles in half.
 */

/** How wide a tile may drift from the row's average, as perspective narrows the far end. */
const MINIMUM_PITCH_RATIO = 0.7;
const MAXIMUM_PITCH_RATIO = 1.42;

export interface TileRow {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

export type RowSplit =
  | { readonly kind: "success"; readonly tiles: readonly NormalizedBounds[] }
  | { readonly kind: "failure"; readonly message: string };

function luminanceOf(frame: PixelFrame): Float32Array {
  const out = new Float32Array(frame.width * frame.height);
  for (let index = 0, offset = 0; index < out.length; index += 1, offset += 4) {
    out[index] =
      ((frame.data[offset] ?? 0) + (frame.data[offset + 1] ?? 0) + (frame.data[offset + 2] ?? 0)) /
      3;
  }
  return out;
}

/** Mean of a window, applied along one axis then the other. */
function blur(values: Float32Array, width: number, height: number, radius: number): Float32Array {
  const pass = new Float32Array(values.length);
  const out = new Float32Array(values.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let total = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const j = x + k;
        if (j >= 0 && j < width) {
          total += values[y * width + j] ?? 0;
          count += 1;
        }
      }
      pass[y * width + x] = total / Math.max(1, count);
    }
  }
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      let total = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const j = y + k;
        if (j >= 0 && j < height) {
          total += pass[j * width + x] ?? 0;
          count += 1;
        }
      }
      out[y * width + x] = total / Math.max(1, count);
    }
  }
  return out;
}

/** Edge magnitude per pixel — the signal that separates tiles from any table. */
function edges(luminance: Float32Array, width: number, height: number): Float32Array {
  const out = new Float32Array(luminance.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const dx = (luminance[index + 1] ?? 0) - (luminance[index - 1] ?? 0);
      const dy = (luminance[index + width] ?? 0) - (luminance[index - width] ?? 0);
      out[index] = Math.hypot(dx, dy);
    }
  }
  return out;
}

function span(profile: Float32Array, threshold: number): { from: number; to: number } | null {
  let from = -1;
  let to = -1;
  for (let i = 0; i < profile.length; i += 1) {
    if (profile[i] ?? 0 >= threshold) {
      if (from < 0) {
        from = i;
      }
      to = i;
    }
  }
  return from < 0 || to <= from ? null : { from, to };
}

/**
 * How far the tile row is turned in the frame, in degrees, or null when there
 * is no row-like band to measure.
 *
 * Everything downstream reads the frame by scanline: the row band is found by
 * summing edge density along each row of pixels, and the seams between tiles by
 * summing down each column. Both assume the row is level. A row turned even a
 * few degrees smears its edges across many scanlines, the peak flattens, and
 * the band is never found — the read fails outright, with nothing to tell a
 * player that holding the phone straight would have fixed it.
 *
 * Measured on a small copy, and only coarsely: this exists to say "you are
 * askew, and by roughly this much", not to rectify anything.
 */
export function estimateRowTiltDegrees(frame: PixelFrame): number | null {
  const scaled = downscale(frame, 200);
  if (scaled === null) {
    return null;
  }
  let bestAngle: number | null = null;
  let bestSharpness = 0;
  for (let angle = -14; angle <= 14; angle += 2) {
    const sharpness = rowBandSharpness(scaled, angle);
    if (sharpness > bestSharpness) {
      bestSharpness = sharpness;
      bestAngle = angle;
    }
  }
  return bestAngle;
}

/**
 * How sharply the frame's edge density peaks into a band when read at `angle`.
 * A level row concentrates its edges into few scanlines and scores high; the
 * same row read at the wrong angle spreads them and scores low.
 */
function rowBandSharpness(frame: PixelFrame, angle: number): number {
  const { height, width } = frame;
  const density = edges(luminanceOf(frame), width, height);
  const radians = (angle * Math.PI) / 180;
  const slope = Math.tan(radians);
  const centre = width / 2;
  const rows = new Float32Array(height);
  for (let y = 0; y < height; y += 1) {
    let total = 0;
    let counted = 0;
    for (let x = 0; x < width; x += 1) {
      // Follow the line the row would lie on at this angle, rather than the
      // scanline, and sum the edges along it.
      const sampled = Math.round(y + (x - centre) * slope);
      if (sampled >= 0 && sampled < height) {
        total += density[sampled * width + x] ?? 0;
        counted += 1;
      }
    }
    rows[y] = counted === 0 ? 0 : total / counted;
  }
  const mean = rows.reduce((sum, value) => sum + value, 0) / height;
  return mean === 0 ? 0 : Math.max(...rows) / mean;
}

/** A cheap nearest-neighbour copy, for measurements that do not need detail. */
function downscale(frame: PixelFrame, target: number): PixelFrame | null {
  const { data, height, width } = frame;
  if (width < 32 || height < 32) {
    return null;
  }
  const scale = Math.min(1, target / width);
  const outWidth = Math.max(8, Math.round(width * scale));
  const outHeight = Math.max(8, Math.round(height * scale));
  const out = new Uint8ClampedArray(outWidth * outHeight * 4);
  for (let y = 0; y < outHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < outWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor(x / scale));
      const from = (sourceY * width + sourceX) * 4;
      const to = (y * outWidth + x) * 4;
      out[to] = data[from] ?? 0;
      out[to + 1] = data[from + 1] ?? 0;
      out[to + 2] = data[from + 2] ?? 0;
      out[to + 3] = 255;
    }
  }
  return { data: out, height: outHeight, width: outWidth };
}

/**
 * Locate the band of the frame holding the tiles, by where the edges are.
 *
 * Works on a dark mat and a pale table alike, which a luminance threshold
 * cannot.
 */
export function findTileRow(frame: PixelFrame): TileRow | null {
  const { height, width } = frame;
  if (width < 16 || height < 16) {
    return null;
  }
  const density = blur(
    edges(luminanceOf(frame), width, height),
    width,
    height,
    Math.max(2, Math.round(width / 80)),
  );

  const rows = new Float32Array(height);
  for (let y = 0; y < height; y += 1) {
    let total = 0;
    for (let x = 0; x < width; x += 1) {
      total += density[y * width + x] ?? 0;
    }
    rows[y] = total / width;
  }
  const peak = Math.max(...rows);
  if (peak <= 0) {
    return null;
  }
  const vertical = span(rows, peak * 0.45);
  if (vertical === null) {
    return null;
  }

  const columns = new Float32Array(width);
  for (let x = 0; x < width; x += 1) {
    let total = 0;
    for (let y = vertical.from; y <= vertical.to; y += 1) {
      total += density[y * width + x] ?? 0;
    }
    columns[x] = total / Math.max(1, vertical.to - vertical.from + 1);
  }
  const horizontal = span(columns, Math.max(...columns) * 0.35);
  if (horizontal === null) {
    return null;
  }
  return {
    bottom: vertical.to,
    left: horizontal.from,
    right: horizontal.to,
    top: vertical.from,
  };
}

/**
 * How dark each column is relative to its neighbours, judged by its brightest
 * pixel so that a glyph's strokes are not mistaken for a seam.
 */
function seamScores(frame: PixelFrame, row: TileRow): Float32Array {
  const luminance = luminanceOf(frame);
  const width = row.right - row.left + 1;
  const ceiling = new Float32Array(width);
  for (let x = 0; x < width; x += 1) {
    let brightest = 0;
    for (let y = row.top; y <= row.bottom; y += 1) {
      const value = luminance[y * frame.width + row.left + x] ?? 0;
      if (value > brightest) {
        brightest = value;
      }
    }
    ceiling[x] = brightest;
  }
  const smooth = blur(ceiling, width, 1, Math.max(4, Math.round(width / 40)));
  const out = new Float32Array(width);
  for (let x = 0; x < width; x += 1) {
    out[x] = Math.max(0, (smooth[x] ?? 0) - (ceiling[x] ?? 0));
  }
  return out;
}

/**
 * Divide a located row into `count` tiles, putting the cuts on the seams.
 *
 * Spacing is allowed to drift between `MINIMUM_PITCH_RATIO` and
 * `MAXIMUM_PITCH_RATIO` of the average, which is what lets a row photographed
 * at an angle — where the far tiles are narrower — still divide correctly.
 */
export function splitTileRow(frame: PixelFrame, row: TileRow, count: number): RowSplit {
  if (!Number.isInteger(count) || count < 1) {
    return { kind: "failure", message: "A row must be split into a whole number of tiles." };
  }
  const width = row.right - row.left;
  if (width < count * 4) {
    return {
      kind: "failure",
      message: `The tiles are too small to read. Fill more of the frame with the hand.`,
    };
  }
  if (count === 1) {
    return { kind: "success", tiles: [boundsOf(frame, row, row.left, row.right)] };
  }

  const scores = seamScores(frame, row);
  const average = width / count;
  const minimum = Math.max(1, Math.floor(average * MINIMUM_PITCH_RATIO));
  const maximum = Math.max(minimum + 1, Math.ceil(average * MAXIMUM_PITCH_RATIO));

  // Every boundary is chosen, the outer two included. Pinning them to the ends
  // of the detected row makes the first and last tile absorb whatever the row
  // extent got wrong — the interior came out exact while the ends were 46px and
  // 28px against a true 35.
  const margin = Math.max(2, Math.round(average * 0.4));
  const unreachable = Number.NEGATIVE_INFINITY;
  const best = Array.from({ length: count + 1 }, () =>
    new Float64Array(width + 1).fill(unreachable),
  );
  const from = Array.from({ length: count + 1 }, () => new Int32Array(width + 1));
  const first = best[0];
  if (first !== undefined) {
    for (let x = 0; x <= Math.min(margin, width); x += 1) {
      first[x] = scores[x] ?? 0;
    }
  }

  for (let k = 1; k <= count; k += 1) {
    const previous = best[k - 1];
    const current = best[k];
    const trail = from[k];
    if (previous === undefined || current === undefined || trail === undefined) {
      continue;
    }
    for (let x = minimum * k; x <= Math.min(width, maximum * k + margin); x += 1) {
      const low = Math.max(0, x - maximum);
      const high = x - minimum;
      let bestValue = unreachable;
      let bestIndex = low;
      for (let j = low; j <= high; j += 1) {
        const value = previous[j] ?? unreachable;
        if (value > bestValue) {
          bestValue = value;
          bestIndex = j;
        }
      }
      if (bestValue === unreachable) {
        continue;
      }
      current[x] = bestValue + (scores[x] ?? 0);
      trail[x] = bestIndex;
    }
  }

  const last = best[count];
  if (last === undefined) {
    return { kind: "failure", message: "The hand row could not be divided." };
  }
  let end = -1;
  let endValue = unreachable;
  for (let x = Math.max(0, width - margin); x <= width; x += 1) {
    const value = last[x] ?? unreachable;
    if (value > endValue) {
      endValue = value;
      end = x;
    }
  }
  if (end < 0) {
    return {
      kind: "failure",
      message: `The hand does not divide into ${count} tiles. Check the count, or straighten the row.`,
    };
  }

  const boundaries: number[] = [];
  let at = end;
  for (let k = count; k >= 0; k -= 1) {
    boundaries.push(at);
    at = from[k]?.[at] ?? 0;
  }
  boundaries.reverse();
  for (let i = 1; i < boundaries.length; i += 1) {
    if ((boundaries[i] ?? 0) <= (boundaries[i - 1] ?? 0)) {
      return { kind: "failure", message: "The hand row could not be divided evenly enough." };
    }
  }
  const tiles: NormalizedBounds[] = [];
  for (let i = 0; i < count; i += 1) {
    tiles.push(
      boundsOf(frame, row, row.left + (boundaries[i] ?? 0), row.left + (boundaries[i + 1] ?? 0)),
    );
  }
  return { kind: "success", tiles };
}

function boundsOf(frame: PixelFrame, row: TileRow, left: number, right: number): NormalizedBounds {
  return {
    height: (row.bottom - row.top + 1) / frame.height,
    width: (right - left) / frame.width,
    x: left / frame.width,
    y: row.top / frame.height,
  };
}

/**
 * How many tiles the frame appears to hold, for the capture guide to show while
 * a player is still framing the shot.
 *
 * Counts the seams rather than the tiles: a run of touching tiles has no gaps to
 * count, but it does have a seam between each neighbouring pair.
 */
export function estimateTileCount(frame: PixelFrame): number {
  const row = findTileRow(frame);
  if (row === null) {
    return 0;
  }
  const scores = seamScores(frame, row);
  const width = scores.length;
  if (width < 8) {
    return 0;
  }
  const peak = Math.max(...scores);
  if (peak <= 0) {
    return 0;
  }
  // A seam has to stand out from the run of the row, and two peaks closer than
  // a plausible tile width are the same seam seen twice.
  const threshold = peak * 0.4;
  const apart = Math.max(4, Math.round(width / 30));
  let seams = 0;
  let lastAt = -apart;
  for (let x = 1; x < width - 1; x += 1) {
    const value = scores[x] ?? 0;
    if (
      value >= threshold &&
      value >= (scores[x - 1] ?? 0) &&
      value >= (scores[x + 1] ?? 0) &&
      x - lastAt >= apart
    ) {
      seams += 1;
      lastAt = x;
    }
  }
  return seams + 1;
}
