import { describe, expect, it } from "vitest";

import type { DetectedTile, RecognitionResult } from "../domain/recognition";
import { chooseWinningDetection, correctDetection, reviewRecognition } from "./review-recognition";

function detection(
  id: string,
  tile: DetectedTile["tile"],
  role: DetectedTile["role"],
  confidence = 0.99,
): DetectedTile {
  return {
    alternatives: [],
    bounds: { height: 0.2, width: 0.07, x: 0.1, y: 0.5 },
    confidence,
    id,
    role,
    tile,
  };
}

function recognition(detections: readonly DetectedTile[]): RecognitionResult {
  return { detections, modelVersion: "test-1" };
}

describe("reviewRecognition", () => {
  it("allows one confident winning tile and confident hand tiles", () => {
    const review = reviewRecognition(
      recognition([detection("a", "1m", "concealed"), detection("b", "2m", "winning")]),
    );

    expect(review).toEqual({ issues: [], readyToConfirm: true, reviewDetectionIds: [] });
  });

  it("puts unknown and lowest-confidence detections first", () => {
    const review = reviewRecognition(
      recognition([
        detection("winner", "2m", "winning"),
        detection("uncertain", "3p", "concealed", 0.85),
        detection("unknown", null, "unknown", 0.4),
      ]),
    );

    expect(review.reviewDetectionIds).toEqual(["unknown", "uncertain"]);
    expect(review.issues.map(({ kind }) => kind)).toEqual([
      "uncertain",
      "unknown-tile",
      "unknown-role",
    ]);
  });

  it("flags impossible physical counts and ambiguous winning tiles", () => {
    const review = reviewRecognition(
      recognition([
        detection("a", "5m", "winning"),
        detection("b", "5m", "winning"),
        detection("c", "5m", "concealed"),
        detection("d", "5m", "concealed"),
        detection("e", "5m", "concealed"),
      ]),
    );

    expect(review.issues.map(({ kind }) => kind)).toEqual([
      "impossible-count",
      "winning-tile-count",
    ]);
    expect(review.reviewDetectionIds).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("correctDetection", () => {
  it("applies an explicit correction without changing detector evidence", () => {
    const original = recognition([detection("a", null, "unknown", 0.2)]);

    const corrected = correctDetection(original, "a", { role: "winning", tile: "red" });

    expect(corrected.detections[0]).toMatchObject({ confidence: 1, role: "winning", tile: "red" });
    expect(original.detections[0]).toMatchObject({ confidence: 0.2, role: "unknown", tile: null });
  });

  it("rejects a stale correction target", () => {
    expect(() =>
      correctDetection(recognition([]), "missing", { role: "concealed", tile: "1m" }),
    ).toThrow("does not exist");
  });
});

describe("chooseWinningDetection", () => {
  it("moves the winning role atomically between concealed detections", () => {
    const result = recognition([
      detection("first", "1m", "winning"),
      detection("second", "2m", "concealed"),
      detection("dora", "3m", "dora"),
    ]);

    expect(chooseWinningDetection(result, "second").detections).toMatchObject([
      { id: "first", role: "concealed" },
      { confidence: 1, id: "second", role: "winning" },
      { id: "dora", role: "dora" },
    ]);
    expect(() => chooseWinningDetection(result, "dora")).toThrow(/concealed hand tile/);
  });
});

describe("guarding programmer errors", () => {
  const concealed = {
    alternatives: [{ confidence: 0.9, tile: "1m" }],
    bounds: { height: 0.4, width: 0.1, x: 0.1, y: 0.2 },
    confidence: 0.9,
    id: "hand-0",
    role: "concealed",
    tile: "1m",
  } as const;
  const result = { detections: [concealed], modelVersion: "test" } as const;

  it("refuses a confidence threshold outside the probability range", () => {
    expect(() => reviewRecognition(result, 0)).toThrow(RangeError);
    expect(() => reviewRecognition(result, -0.5)).toThrow(RangeError);
    expect(() => reviewRecognition(result, 1.5)).toThrow(RangeError);
    // The ends of the range are legitimate.
    expect(() => reviewRecognition(result, 1)).not.toThrow();
  });

  it("refuses to correct a detection that is not in the result", () => {
    expect(() => correctDetection(result, "missing", { role: "concealed", tile: "2m" })).toThrow(
      /does not exist/,
    );
  });

  it("refuses to mark a missing detection as the winning tile", () => {
    expect(() => chooseWinningDetection(result, "missing")).toThrow(/does not exist/);
  });

  it("refuses to mark an indicator or a called tile as the winning tile", () => {
    for (const role of ["dora", "ura", "meld"] as const) {
      const other = { detections: [{ ...concealed, role }], modelVersion: "test" } as const;
      expect(() => chooseWinningDetection(other, "hand-0")).toThrow(/concealed hand tile/);
    }
  });

  it("sorts a tile with no reading behind one that has a reading", () => {
    const unread = { ...concealed, id: "hand-1", role: "unknown", tile: null } as const;
    const review = reviewRecognition(
      { detections: [unread, concealed], modelVersion: "test" },
      0.5,
    );

    // The unreadable tile is what needs attention first.
    expect(review.reviewDetectionIds[0]).toBe("hand-1");
  });
});
