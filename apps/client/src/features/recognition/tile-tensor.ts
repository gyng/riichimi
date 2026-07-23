import type { NormalizedBounds } from "@riichimi/vision";

import type { PixelFrame } from "./guided-layout";

export const tileTensorHeight = 64;
export const tileTensorWidth = 48;

function percentile(channel: Uint8Array, ratio: number): number {
  const sorted = Array.from(channel).toSorted((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

export function cropTileTensor(frame: PixelFrame, bounds: NormalizedBounds): Float32Array {
  const pixels = tileTensorHeight * tileTensorWidth;
  const channels = [new Uint8Array(pixels), new Uint8Array(pixels), new Uint8Array(pixels)];
  const left = bounds.x * frame.width;
  const top = bounds.y * frame.height;
  const cropWidth = bounds.width * frame.width;
  const cropHeight = bounds.height * frame.height;
  for (let y = 0; y < tileTensorHeight; y += 1) {
    const sourceY = Math.min(
      frame.height - 1,
      Math.max(0, Math.round(top + ((y + 0.5) / tileTensorHeight) * cropHeight)),
    );
    for (let x = 0; x < tileTensorWidth; x += 1) {
      const sourceX = Math.min(
        frame.width - 1,
        Math.max(0, Math.round(left + ((x + 0.5) / tileTensorWidth) * cropWidth)),
      );
      const sourceOffset = (sourceY * frame.width + sourceX) * 4;
      const targetOffset = y * tileTensorWidth + x;
      for (let channel = 0; channel < channels.length; channel += 1) {
        const values = channels[channel];
        if (values !== undefined) {
          values[targetOffset] = frame.data[sourceOffset + channel] ?? 0;
        }
      }
    }
  }

  const tensor = new Float32Array(pixels * 3);
  for (let channel = 0; channel < channels.length; channel += 1) {
    const values = channels[channel];
    if (values === undefined) {
      continue;
    }
    const low = percentile(values, 0.005);
    const high = percentile(values, 0.995);
    const range = Math.max(1, high - low);
    for (let index = 0; index < pixels; index += 1) {
      const contrasted = Math.max(0, Math.min(255, ((values[index] ?? 0) - low) * (255 / range)));
      tensor[channel * pixels + index] = contrasted / 127.5 - 1;
    }
  }
  return tensor;
}

export function combineTileTensors(tensors: readonly Float32Array[]): Float32Array {
  const tileSize = 3 * tileTensorHeight * tileTensorWidth;
  const combined = new Float32Array(tensors.length * tileSize);
  tensors.forEach((tensor, index) => {
    if (tensor.length !== tileSize) {
      throw new RangeError(
        `Tile tensor ${index} has ${tensor.length} values; expected ${tileSize}.`,
      );
    }
    combined.set(tensor, index * tileSize);
  });
  return combined;
}
