import type { NormalizedBounds } from "@riichimi/vision";

import type { PixelFrame } from "./guided-layout";
import { estimateRowTiltDegrees } from "./tile-row";

/**
 * Turn a photographed row level before anything tries to read it.
 *
 * The locator sums edge density along each scanline to find the band holding
 * the tiles, and sums down each column to find the seams between them. Both
 * assume the row is level; a row turned a few degrees smears its edges across
 * many scanlines and is simply never found.
 *
 * That is not a corner case. Across seventeen real photographs of games, ten
 * were turned between six and fourteen degrees and none of the seventeen ever
 * reached a read. People photograph a table from where they are sitting, and a
 * phone held in one hand is never square. Asking them to hold it straighter is
 * not a fix when the answer is a rotation the computer can do itself.
 */

/** Below this the row reads fine, and rotating costs a copy for nothing. */
const worthRotatingDegrees = 2;

export interface Deskewed {
  /** The levelled frame: what the locator reads and what the crops come from. */
  readonly frame: PixelFrame;
  /** How far it was turned, or null when it was already level enough. */
  readonly appliedDegrees: number | null;
  /**
   * Puts a box found in the levelled frame back where it belongs on the photo
   * the player is looking at. The review overlay draws on their photo, not on
   * ours.
   */
  readonly toOriginal: (bounds: NormalizedBounds) => NormalizedBounds;
}

/** Bilinear sample, so a rotated tile face does not arrive with jagged strokes. */
function sample(frame: PixelFrame, x: number, y: number, into: Uint8ClampedArray, at: number) {
  const { data, height, width } = frame;
  if (x < 0 || y < 0 || x > width - 1 || y > height - 1) {
    // Outside the photo: the paper the app is drawn on, so an edge tile is not
    // framed against black.
    into[at] = 236;
    into[at + 1] = 232;
    into[at + 2] = 222;
    into[at + 3] = 255;
    return;
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  for (let channel = 0; channel < 3; channel += 1) {
    const topLeft = data[(y0 * width + x0) * 4 + channel] ?? 0;
    const topRight = data[(y0 * width + x1) * 4 + channel] ?? 0;
    const bottomLeft = data[(y1 * width + x0) * 4 + channel] ?? 0;
    const bottomRight = data[(y1 * width + x1) * 4 + channel] ?? 0;
    const top = topLeft + (topRight - topLeft) * fx;
    const bottom = bottomLeft + (bottomRight - bottomLeft) * fx;
    into[at + channel] = top + (bottom - top) * fy;
  }
  into[at + 3] = 255;
}

/**
 * Level the frame if it is turned. The canvas grows to hold the rotated photo,
 * so a corner tile is not lost to the crop that levelling would otherwise cost.
 */
export function deskewFrame(frame: PixelFrame): Deskewed {
  const identity = {
    appliedDegrees: null,
    frame,
    toOriginal: (bounds) => bounds,
  } satisfies Deskewed;
  const tilt = estimateRowTiltDegrees(frame);
  if (tilt === null || Math.abs(tilt) < worthRotatingDegrees) {
    return identity;
  }

  const radians = (-tilt * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const { height, width } = frame;
  const outWidth = Math.ceil(Math.abs(width * cos) + Math.abs(height * sin));
  const outHeight = Math.ceil(Math.abs(width * sin) + Math.abs(height * cos));
  const data = new Uint8ClampedArray(outWidth * outHeight * 4);

  const centreX = width / 2;
  const centreY = height / 2;
  const outCentreX = outWidth / 2;
  const outCentreY = outHeight / 2;

  for (let y = 0; y < outHeight; y += 1) {
    const dy = y - outCentreY;
    for (let x = 0; x < outWidth; x += 1) {
      const dx = x - outCentreX;
      // Sampled backwards from the destination, which is what keeps the result
      // free of the holes a forward mapping leaves.
      sample(
        frame,
        centreX + dx * cos + dy * sin,
        centreY - dx * sin + dy * cos,
        data,
        (y * outWidth + x) * 4,
      );
    }
  }

  const toOriginal = (bounds: NormalizedBounds): NormalizedBounds => {
    const corners = [
      [bounds.x, bounds.y],
      [bounds.x + bounds.width, bounds.y],
      [bounds.x + bounds.width, bounds.y + bounds.height],
      [bounds.x, bounds.y + bounds.height],
    ] as const;
    const mapped = corners.map(([nx, ny]) => {
      const dx = (nx ?? 0) * outWidth - outCentreX;
      const dy = (ny ?? 0) * outHeight - outCentreY;
      return [
        (centreX + dx * cos + dy * sin) / width,
        (centreY - dx * sin + dy * cos) / height,
      ] as const;
    });
    const xs = mapped.map(([mx]) => mx);
    const ys = mapped.map(([, my]) => my);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    // The upright box around the turned one: the overlay draws rectangles, and
    // a box that contains the tile is honest where a turned one cannot be drawn.
    return {
      height: Math.max(...ys) - top,
      width: Math.max(...xs) - left,
      x: left,
      y: top,
    };
  };

  return { appliedDegrees: tilt, frame: { data, height: outHeight, width: outWidth }, toOriginal };
}
