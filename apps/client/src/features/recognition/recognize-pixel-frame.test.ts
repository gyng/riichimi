import { recognitionModelClasses } from "@richii/vision";

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

describe("recognizePixelFrame", () => {
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
    const classifier = jest.fn<Promise<Float32Array>, []>();

    await expect(recognizePixelFrame(frame, classifier)).rejects.toThrow(/dora indicator below/);
    expect(classifier).not.toHaveBeenCalled();
  });

  it("rejects severe glare before layout or model initialization", async () => {
    const frame = guidedFrame();
    frame.data.fill(255, 0, Math.floor(frame.data.length * 0.2));
    const classifier = jest.fn<Promise<Float32Array>, []>();

    await expect(recognizePixelFrame(frame, classifier)).rejects.toMatchObject({ code: "glare" });
    expect(classifier).not.toHaveBeenCalled();
  });
});
