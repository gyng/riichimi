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
