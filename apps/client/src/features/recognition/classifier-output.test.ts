import { recognitionModelClasses } from "@richii/vision";

import { classifyBatchLogits } from "./classifier-output";

describe("classifier output", () => {
  it("turns logits into calibrated candidates and preserves unknown rejection", () => {
    const logits = new Float32Array(recognitionModelClasses.length * 2).fill(-4);
    logits[0] = 5;
    logits[recognitionModelClasses.length * 2 - 1] = 6;

    const [known, unknown] = classifyBatchLogits(logits, 2);

    expect(known).toMatchObject({ tile: "1m" });
    expect(known?.confidence).toBeGreaterThan(0.9);
    expect(unknown).toMatchObject({ tile: null });
  });

  it("rejects an output tensor with the wrong shape", () => {
    expect(() => classifyBatchLogits(new Float32Array(3), 1)).toThrow(RangeError);
  });
});
