import { describe, expect, it } from "vitest";

import type { DetectedTile } from "../domain/recognition";
import { prioritizeDetectionsForReview } from "./prioritize-review";

const bounds = { height: 0.2, width: 0.08, x: 0.1, y: 0.5 } as const;

function detection(id: string, confidence: number, tile: DetectedTile["tile"]): DetectedTile {
  return { alternatives: [], bounds, confidence, id, role: "concealed", tile };
}

describe("prioritizeDetectionsForReview", () => {
  it("returns only uncertain tiles with the least certain first", () => {
    const result = prioritizeDetectionsForReview([
      detection("certain", 0.99, "1m"),
      detection("unknown", 0.72, null),
      detection("uncertain", 0.84, "9s"),
    ]);

    expect(result.map(({ id }) => id)).toEqual(["unknown", "uncertain"]);
  });

  it("does not mutate detector order", () => {
    const detections = [detection("second", 0.8, "1p"), detection("first", 0.7, "2p")];

    prioritizeDetectionsForReview(detections);

    expect(detections.map(({ id }) => id)).toEqual(["second", "first"]);
  });

  it.each([0, -0.1, 1.1])("rejects an invalid confidence threshold of %s", (threshold) => {
    expect(() => prioritizeDetectionsForReview([], threshold)).toThrow(RangeError);
  });
});
