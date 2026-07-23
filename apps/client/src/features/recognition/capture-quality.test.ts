import { inspectFrameExposure, inspectLocatedCapture } from "./capture-quality";
import type { PixelFrame, GuidedLayoutResult } from "./guided-layout";

function frame(fill = 32): PixelFrame {
  const width = 200;
  const height = 120;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    data[offset] = fill;
    data[offset + 1] = fill;
    data[offset + 2] = fill;
    data[offset + 3] = 255;
  }
  return { data, height, width };
}

function layout(
  overrides: Partial<Extract<GuidedLayoutResult, { kind: "success" }>> = {},
): Extract<GuidedLayoutResult, { kind: "success" }> {
  return {
    dora: { height: 0.2, width: 0.12, x: 0.8, y: 0.7 },
    hand: Array.from({ length: 14 }, (_, index) => ({
      height: 0.3,
      width: 0.045,
      x: 0.03 + index * 0.065,
      y: 0.2,
    })),
    kind: "success",
    winningIndex: 13,
    winningRoleCertain: true,
    ...overrides,
  };
}

function addSharpDetail(input: PixelFrame): PixelFrame {
  for (let y = 20; y < 90; y += 1) {
    for (let x = 10; x < 190; x += 1) {
      const value = (x + y) % 2 === 0 ? 230 : 38;
      const offset = (y * input.width + x) * 4;
      input.data[offset] = value;
      input.data[offset + 1] = value;
      input.data[offset + 2] = value;
    }
  }
  return input;
}

describe("capture quality", () => {
  it("accepts a sharp, evenly exposed, fully framed layout", () => {
    const input = addSharpDetail(frame());

    expect(inspectFrameExposure(input)).toBeNull();
    expect(inspectLocatedCapture(input, layout())).toBeNull();
  });

  it("identifies glare before attempting layout or inference", () => {
    const input = frame();
    input.data.fill(255, 0, Math.floor(input.data.length * 0.2));

    expect(inspectFrameExposure(input)).toMatchObject({ kind: "glare" });
  });

  it("gives a dedicated crop message when a detected tile touches an edge", () => {
    const input = addSharpDetail(frame());
    const current = layout();
    const first = current.hand[0];
    if (first === undefined) {
      throw new Error("Expected a guided hand tile.");
    }

    expect(
      inspectLocatedCapture(input, {
        ...current,
        hand: [{ ...first, x: 0 }, ...current.hand.slice(1)],
      }),
    ).toMatchObject({ kind: "crop" });
  });

  it("separates excessive perspective from ordinary geometry failures", () => {
    const input = addSharpDetail(frame());
    const current = layout();
    const last = current.hand.at(-1);
    if (last === undefined) {
      throw new Error("Expected a guided hand tile.");
    }

    expect(
      inspectLocatedCapture(input, {
        ...current,
        hand: [...current.hand.slice(0, -1), { ...last, height: 0.16, width: 0.045 }],
      }),
    ).toMatchObject({ kind: "perspective" });
  });

  it("rejects a located but textureless frame as too blurry", () => {
    expect(inspectLocatedCapture(frame(), layout())).toMatchObject({ kind: "blur" });
  });
});
