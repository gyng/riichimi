import type { DetectedTile } from "../domain/recognition";

export function prioritizeDetectionsForReview(
  detections: readonly DetectedTile[],
  confidenceThreshold = 0.9,
): readonly DetectedTile[] {
  if (confidenceThreshold <= 0 || confidenceThreshold > 1) {
    throw new RangeError("Confidence threshold must be greater than 0 and at most 1.");
  }

  return detections
    .filter(({ confidence, tile }) => tile === null || confidence < confidenceThreshold)
    .toSorted((left, right) => left.confidence - right.confidence);
}
