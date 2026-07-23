import type { NormalizedBounds } from "@richii/vision";

export interface PixelFrame {
  readonly data: Uint8ClampedArray;
  readonly height: number;
  readonly width: number;
}

export type GuidedLayoutResult =
  | {
      readonly dora: NormalizedBounds;
      readonly hand: readonly NormalizedBounds[];
      readonly kind: "success";
      readonly winningIndex: number;
      readonly winningRoleCertain: boolean;
    }
  | {
      readonly foundTileFaces: number;
      readonly kind: "failure";
      readonly message: string;
    };

interface Component {
  readonly area: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

function candidateComponents(frame: PixelFrame): readonly Component[] {
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

function normalized(component: Component, frame: PixelFrame): NormalizedBounds {
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

export function locateGuidedTiles(frame: PixelFrame): GuidedLayoutResult {
  if (
    frame.width <= 0 ||
    frame.height <= 0 ||
    frame.data.length !== frame.width * frame.height * 4
  ) {
    throw new RangeError("Pixel frame dimensions must match its RGBA data.");
  }
  const components = candidateComponents(frame);
  const rows: Component[][] = [];
  for (const component of components.toSorted((left, right) => centerY(left) - centerY(right))) {
    const componentHeight = component.bottom - component.top + 1;
    const row = rows.find((items) => {
      const averageCenter = items.reduce((sum, item) => sum + centerY(item), 0) / items.length;
      return Math.abs(centerY(component) - averageCenter) <= componentHeight * 0.42;
    });
    if (row === undefined) {
      rows.push([component]);
    } else {
      row.push(component);
    }
  }
  const handRow = rows
    .filter((row) => row.length >= 10)
    .toSorted((left, right) => Math.abs(left.length - 14) - Math.abs(right.length - 14))[0];
  if (handRow === undefined || handRow.length !== 14) {
    return {
      foundTileFaces: components.length,
      kind: "failure",
      message: `Found ${components.length} tile-like faces, but the guided row needs exactly 14 separated tiles.`,
    };
  }
  const hand = handRow.toSorted((left, right) => left.left - right.left);
  const handSet = new Set(hand);
  const doraCandidates = components.filter((component) => !handSet.has(component));
  if (doraCandidates.length !== 1) {
    return {
      foundTileFaces: components.length,
      kind: "failure",
      message: `The hand was found, but the guide needs exactly one separated dora indicator; found ${doraCandidates.length}.`,
    };
  }
  const dora = doraCandidates[0];
  const handBottom = Math.max(...hand.map(({ bottom }) => bottom));
  if (dora === undefined || centerY(dora) <= handBottom) {
    return {
      foundTileFaces: components.length,
      kind: "failure",
      message: "Place the one dora indicator below the 14-tile hand row.",
    };
  }
  const gaps = hand.slice(1).map((component, index) => component.left - (hand[index]?.right ?? 0));
  const sortedGaps = gaps.toSorted((left, right) => left - right);
  const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)] ?? 0;
  const maximumGap = Math.max(...gaps);
  const winningIndex = gaps.indexOf(maximumGap) + 1;
  const winningRoleCertain = maximumGap >= Math.max(frame.width * 0.012, medianGap * 1.7);
  return {
    dora: normalized(dora, frame),
    hand: hand.map((component) => normalized(component, frame)),
    kind: "success",
    winningIndex: winningRoleCertain ? winningIndex : 13,
    winningRoleCertain,
  };
}
