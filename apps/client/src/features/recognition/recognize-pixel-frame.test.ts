import { describe, expect, it, vi } from "vitest";
import { recognitionModelClasses } from "@riichimi/vision";

import { recognizePixelFrame } from "./recognize-pixel-frame";
import type { PixelFrame } from "./guided-layout";

function guidedFrame(): PixelFrame {
  const width = 620;
  const height = 260;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = 25;
    data[index * 4 + 1] = 70;
    data[index * 4 + 2] = 55;
    data[index * 4 + 3] = 255;
  }
  const rectangle = (left: number, top: number) => {
    for (let y = top; y < top + 54; y += 1) {
      for (let x = left; x < left + 34; x += 1) {
        const offset = (y * width + x) * 4;
        data[offset] = 240;
        data[offset + 1] = 238;
        data[offset + 2] = 226;
      }
    }
  };
  for (let index = 0; index < 14; index += 1) {
    rectangle(16 + index * 41 + (index >= 11 ? 16 : 0), 42);
  }
  rectangle(530, 150);
  return { data, height, width };
}

function naturalRowFrame(): PixelFrame {
  const width = 900;
  const height = 200;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = 25;
    data[index * 4 + 1] = 70;
    data[index * 4 + 2] = 55;
    data[index * 4 + 3] = 255;
  }
  const rectangle = (left: number) => {
    for (let y = 70; y < 124; y += 1) {
      for (let x = left; x < left + 34; x += 1) {
        const offset = (y * width + x) * 4;
        data[offset] = 240;
        data[offset + 1] = 238;
        data[offset + 2] = 226;
      }
    }
  };
  // One row: 11 concealed (winner nudged after the 8th), a pon of 3, then one dora.
  let x = 20;
  for (let index = 0; index < 11; index += 1) {
    rectangle(x + (index >= 8 ? 16 : 0));
    x += 40;
  }
  x += 50;
  for (let index = 0; index < 3; index += 1) {
    rectangle(x);
    x += 40;
  }
  rectangle(x + 50);
  return { data, height, width };
}

describe("recognizePixelFrame", () => {
  it("dispatches the natural layout to the single-row parser and marks a called meld", async () => {
    const result = await recognizePixelFrame(
      naturalRowFrame(),
      async (_, dimensions) => {
        const [count] = dimensions;
        const logits = new Float32Array(count * recognitionModelClasses.length).fill(-4);
        for (let index = 0; index < count; index += 1) {
          logits[index * recognitionModelClasses.length] = 5;
        }
        return logits;
      },
      "natural",
    );

    expect(result.detections.filter(({ role }) => role === "meld")).toHaveLength(3);
    expect(result.detections.filter(({ role }) => role === "winning")).toHaveLength(1);
    expect(result.detections.at(-1)).toMatchObject({ id: "dora-0", role: "dora" });
  });

  it("classifies one batch and maps guided geometry to hand roles", async () => {
    const result = await recognizePixelFrame(guidedFrame(), async (_, dimensions) => {
      expect(dimensions).toEqual([15, 3, 64, 48]);
      const logits = new Float32Array(15 * recognitionModelClasses.length).fill(-4);
      for (let index = 0; index < 15; index += 1) {
        logits[index * recognitionModelClasses.length] = 5;
      }
      return logits;
    });

    expect(result.detections).toHaveLength(15);
    expect(result.detections.filter(({ role }) => role === "winning")).toHaveLength(1);
    expect(result.detections.at(-1)).toMatchObject({ id: "dora-0", role: "dora", tile: "1m" });
  });

  it("does not call the classifier when guided geometry is incomplete", async () => {
    const frame = guidedFrame();
    frame.data.fill(0);
    const classifier = vi.fn<() => Promise<Float32Array>>();

    await expect(recognizePixelFrame(frame, classifier)).rejects.toThrow(/dora indicator below/);
    expect(classifier).not.toHaveBeenCalled();
  });

  it("rejects severe glare before layout or model initialization", async () => {
    const frame = guidedFrame();
    frame.data.fill(255, 0, Math.floor(frame.data.length * 0.2));
    const classifier = vi.fn<() => Promise<Float32Array>>();

    await expect(recognizePixelFrame(frame, classifier)).rejects.toMatchObject({ code: "glare" });
    expect(classifier).not.toHaveBeenCalled();
  });
});
