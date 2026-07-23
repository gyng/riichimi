import type { NormalizedBounds } from "@riichimi/vision";

export interface PixelFrame {
  readonly data: Uint8ClampedArray;
  readonly height: number;
  readonly width: number;
}

export type GuidedLayoutResult =
  | {
      /** The concealed hand row, left-to-right. A closed hand is the whole hand. */
      readonly concealed: readonly NormalizedBounds[];
      readonly dora: NormalizedBounds;
      /** Called melds, each a group of 3 (chi/pon) or 4 (kan) tiles. Empty for a
          fully concealed hand. */
      readonly melds: readonly (readonly NormalizedBounds[])[];
      readonly kind: "success";
      /** Index of the winning tile within `concealed`. */
      readonly winningIndex: number;
      readonly winningRoleCertain: boolean;
    }
  | {
      readonly foundTileFaces: number;
      readonly kind: "failure";
      readonly message: string;
    };

export interface Component {
  readonly area: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

export function candidateComponents(frame: PixelFrame): readonly Component[] {
  const { data, height, width } = frame;
  const size = width * height;
  const mask = new Uint8Array(size);
  for (let index = 0; index < size; index += 1) {
    const offset = index * 4;
    const red = data[offset] ?? 0;
    const green = data[offset + 1] ?? 0;
    const blue = data[offset + 2] ?? 0;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const luminance = (red + green + blue) / 3;
    if (luminance >= 125 && maximum - minimum <= 92) {
      mask[index] = 1;
    }
  }

  const visited = new Uint8Array(size);
  const stack = new Int32Array(size);
  const components: Component[] = [];
  const minimumArea = size * 0.0007;
  for (let start = 0; start < size; start += 1) {
    if (mask[start] !== 1 || visited[start] === 1) {
      continue;
    }
    let stackSize = 1;
    stack[0] = start;
    visited[start] = 1;
    let area = 0;
    let left = width;
    let right = 0;
    let top = height;
    let bottom = 0;
    while (stackSize > 0) {
      stackSize -= 1;
      const current = stack[stackSize] ?? 0;
      const x = current % width;
      const y = Math.floor(current / width);
      area += 1;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      const neighbors = [
        x > 0 ? current - 1 : -1,
        x + 1 < width ? current + 1 : -1,
        y > 0 ? current - width : -1,
        y + 1 < height ? current + width : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && mask[neighbor] === 1 && visited[neighbor] === 0) {
          visited[neighbor] = 1;
          stack[stackSize] = neighbor;
          stackSize += 1;
        }
      }
    }
    const componentWidth = right - left + 1;
    const componentHeight = bottom - top + 1;
    const ratio = componentWidth / componentHeight;
    const fill = area / (componentWidth * componentHeight);
    if (
      area >= minimumArea &&
      componentWidth >= width * 0.018 &&
      componentHeight >= height * 0.055 &&
      componentWidth <= width * 0.16 &&
      componentHeight <= height * 0.5 &&
      ratio >= 0.38 &&
      ratio <= 1.05 &&
      fill >= 0.38
    ) {
      components.push({ area, bottom, left, right, top });
    }
  }
  return components;
}

export function normalized(component: Component, frame: PixelFrame): NormalizedBounds {
  const horizontalPadding = (component.right - component.left + 1) * 0.035;
  const verticalPadding = (component.bottom - component.top + 1) * 0.025;
  const x = Math.max(0, component.left - horizontalPadding);
  const y = Math.max(0, component.top - verticalPadding);
  const right = Math.min(frame.width, component.right + 1 + horizontalPadding);
  const bottom = Math.min(frame.height, component.bottom + 1 + verticalPadding);
  return {
    height: (bottom - y) / frame.height,
    width: (right - x) / frame.width,
    x: x / frame.width,
    y: y / frame.height,
  };
}

function centerY(component: Component): number {
  return (component.top + component.bottom) / 2;
}

export function widthOf(component: Component): number {
  return component.right - component.left + 1;
}

export function median(values: readonly number[]): number {
  const sorted = values.toSorted((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

// Split a left-to-right row into contiguous groups: a gap wider than ~0.5 tile
// widths is a group boundary. Used to separate the called melds in the meld row.
function groupByGaps(row: readonly Component[]): Component[][] {
  const boundary = median(row.map(widthOf)) * 0.5;
  const groups: Component[][] = [];
  let current: Component[] = [];
  for (let index = 0; index < row.length; index += 1) {
    const component = row[index];
    if (component === undefined) {
      continue;
    }
    const previous = row[index - 1];
    if (previous !== undefined && component.left - previous.right > boundary) {
      groups.push(current);
      current = [];
    }
    current.push(component);
  }
  if (current.length > 0) {
    groups.push(current);
  }
  return groups;
}

export function clusterRows(components: readonly Component[]): Component[][] {
  const rows: Component[][] = [];
  for (const component of components.toSorted((left, right) => centerY(left) - centerY(right))) {
    const height = component.bottom - component.top + 1;
    const row = rows.find((items) => {
      const averageCenter = items.reduce((sum, item) => sum + centerY(item), 0) / items.length;
      return Math.abs(centerY(component) - averageCenter) <= height * 0.42;
    });
    if (row === undefined) {
      rows.push([component]);
    } else {
      row.push(component);
    }
  }
  return rows;
}

export function locateGuidedTiles(frame: PixelFrame): GuidedLayoutResult {
  if (
    frame.width <= 0 ||
    frame.height <= 0 ||
    frame.data.length !== frame.width * frame.height * 4
  ) {
    throw new RangeError("Pixel frame dimensions must match its RGBA data.");
  }
  const components = candidateComponents(frame);
  const failure = (message: string): GuidedLayoutResult => ({
    foundTileFaces: components.length,
    kind: "failure",
    message,
  });

  // Rows top-to-bottom: concealed hand, optional meld row(s), then the dora.
  const rows = clusterRows(components).toSorted(
    (left, right) =>
      left.reduce((sum, item) => sum + centerY(item), 0) / left.length -
      right.reduce((sum, item) => sum + centerY(item), 0) / right.length,
  );
  if (rows.length < 2) {
    return failure(
      `Found ${components.length} tile-like faces. Place the hand row on top and one dora indicator below.`,
    );
  }

  const doraRow = rows.at(-1);
  if (doraRow === undefined || doraRow.length !== 1) {
    return failure(
      `The guide needs exactly one separated dora indicator below the hand; found ${doraRow?.length ?? 0}.`,
    );
  }
  const dora = doraRow[0];
  const concealedRow = rows[0];
  if (dora === undefined || concealedRow === undefined) {
    return failure("The hand and dora rows could not be read.");
  }
  if (concealedRow.length < 2) {
    return failure("The concealed hand row needs at least two tiles.");
  }
  if (centerY(dora) <= Math.max(...concealedRow.map((item) => centerY(item)))) {
    return failure("Place the one dora indicator below the hand.");
  }

  // Middle rows hold the called melds. Each meld is a group of 3 (chi/pon) or 4
  // (kan) tiles set apart from its neighbours.
  const melds: Component[][] = [];
  for (const meldRow of rows.slice(1, -1)) {
    for (const group of groupByGaps(meldRow.toSorted((left, right) => left.left - right.left))) {
      if (group.length !== 3 && group.length !== 4) {
        return failure(
          `A called meld needs 3 tiles (chi/pon) or 4 (kan); found a group of ${group.length}.`,
        );
      }
      melds.push(group);
    }
  }

  const totalTiles = concealedRow.length + melds.reduce((sum, meld) => sum + meld.length, 0);
  if (totalTiles < 14 || totalTiles > 18) {
    return failure(
      `A winning hand is 14–18 tiles (with kans); found ${totalTiles} across the hand and melds.`,
    );
  }

  const hand = concealedRow.toSorted((left, right) => left.left - right.left);
  const gaps = hand.slice(1).map((component, index) => component.left - (hand[index]?.right ?? 0));
  const medianGap = median(gaps);
  const maximumGap = gaps.length > 0 ? Math.max(...gaps) : 0;
  const winningIndex = gaps.indexOf(maximumGap) + 1;
  const winningRoleCertain =
    gaps.length > 0 && maximumGap >= Math.max(frame.width * 0.012, medianGap * 1.7);

  return {
    concealed: hand.map((component) => normalized(component, frame)),
    dora: normalized(dora, frame),
    kind: "success",
    melds: melds.map((meld) => meld.map((component) => normalized(component, frame))),
    winningIndex: winningRoleCertain ? winningIndex : hand.length - 1,
    winningRoleCertain,
  };
}
