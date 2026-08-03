import { describe, expect, it } from "vitest";
import { inspectFrameExposure, inspectFrameTilt, inspectLocatedCapture } from "./capture-quality";
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
    concealed: Array.from({ length: 14 }, (_, index) => ({
      height: 0.3,
      width: 0.045,
      x: 0.03 + index * 0.065,
      y: 0.2,
    })),
    dora: { height: 0.2, width: 0.12, x: 0.8, y: 0.7 },
    kind: "success",
    melds: [],
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
    const first = current.concealed[0];
    if (first === undefined) {
      throw new Error("Expected a guided hand tile.");
    }

    expect(
      inspectLocatedCapture(input, {
        ...current,
        concealed: [{ ...first, x: 0 }, ...current.concealed.slice(1)],
      }),
    ).toMatchObject({ kind: "crop" });
  });

  it("separates excessive perspective from ordinary geometry failures", () => {
    const input = addSharpDetail(frame());
    const current = layout();
    const last = current.concealed.at(-1);
    if (last === undefined) {
      throw new Error("Expected a guided hand tile.");
    }

    expect(
      inspectLocatedCapture(input, {
        ...current,
        concealed: [...current.concealed.slice(0, -1), { ...last, height: 0.16, width: 0.045 }],
      }),
    ).toMatchObject({ kind: "perspective" });
  });

  it("rejects a located but textureless frame as too blurry", () => {
    expect(inspectLocatedCapture(frame(), layout())).toMatchObject({ kind: "blur" });
  });
});

/**
 * A row of dark tiles on a pale table, drawn at a given angle. Enough for the
 * measurement, which reads edge density and nothing finer.
 */
function rowAtAngle(degrees: number): PixelFrame {
  const width = 240;
  const height = 120;
  const data = new Uint8ClampedArray(width * height * 4);
  const slope = Math.tan((degrees * Math.PI) / 180);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const centre = height / 2 + (x - width / 2) * slope;
      // Tile faces, with a gap between each so there are edges to find.
      const onRow = Math.abs(y - centre) < 22 && x % 24 < 20 && x > 20 && x < width - 20;
      const value = onRow ? 40 : 232;
      const index = (y * width + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return { data, height, width };
}

describe("inspectFrameTilt", () => {
  it("says nothing about a row that is square with the frame", () => {
    expect(inspectFrameTilt(rowAtAngle(0))).toBeNull();
  });

  it("names the turn on a row the locator would fail to find at all", () => {
    // Past about four degrees the row band is never found, and the read used to
    // end in "retry with another photo" with no reason a player could act on.
    const issue = inspectFrameTilt(rowAtAngle(10));

    expect(issue?.kind).toBe("tilt");
    expect(issue?.message).toMatch(/turned about \d+° in the frame/);
    expect(issue?.message).toContain("Square the camera up");
  });

  it("reads a turn either way", () => {
    expect(inspectFrameTilt(rowAtAngle(-10))?.kind).toBe("tilt");
  });

  it("stays quiet on a frame too small to measure", () => {
    expect(
      inspectFrameTilt({ data: new Uint8ClampedArray(4 * 4 * 4), height: 4, width: 4 }),
    ).toBeNull();
  });
});
