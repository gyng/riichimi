import { canonicalizeTile } from "@richii/score-core";
import type { CanonicalTileId } from "@richii/score-core";

import type {
  DetectedTile,
  RecognitionIssue,
  RecognitionResult,
  RecognitionReview,
} from "../domain/recognition";

function detectionPriority(detection: DetectedTile): number {
  if (detection.tile === null || detection.role === "unknown") {
    return -1;
  }
  return detection.confidence;
}

export function reviewRecognition(
  result: RecognitionResult,
  confidenceThreshold = 0.9,
): RecognitionReview {
  if (confidenceThreshold <= 0 || confidenceThreshold > 1) {
    throw new RangeError("Confidence threshold must be greater than 0 and at most 1.");
  }

  const issues: RecognitionIssue[] = [];
  const byTile = new Map<CanonicalTileId, string[]>();
  for (const detection of result.detections) {
    if (detection.tile === null) {
      issues.push({
        detectionId: detection.id,
        kind: "unknown-tile",
        message: "Choose this tile manually.",
      });
    } else {
      const canonical = canonicalizeTile(detection.tile);
      byTile.set(canonical, [...(byTile.get(canonical) ?? []), detection.id]);
      if (detection.confidence < confidenceThreshold) {
        issues.push({
          detectionId: detection.id,
          kind: "uncertain",
          message: "Confirm this low-confidence tile.",
        });
      }
    }
    if (detection.role === "unknown") {
      issues.push({
        detectionId: detection.id,
        kind: "unknown-role",
        message: "Choose where this tile belongs.",
      });
    }
  }

  for (const [tile, detectionIds] of byTile) {
    if (detectionIds.length > 4) {
      issues.push({
        detectionIds,
        kind: "impossible-count",
        message: `${tile} appears ${detectionIds.length} times; only four physical copies exist.`,
        tile,
      });
    }
  }

  const winningCount = result.detections.filter(({ role }) => role === "winning").length;
  if (winningCount !== 1) {
    issues.push({
      actual: winningCount,
      expected: 1,
      kind: "winning-tile-count",
      message:
        winningCount === 0 ? "Choose the winning tile." : "Only one tile can be the winning tile.",
    });
  }

  const issueIds = new Set<string>();
  for (const issue of issues) {
    if ("detectionId" in issue) {
      issueIds.add(issue.detectionId);
    } else if ("detectionIds" in issue) {
      for (const id of issue.detectionIds) {
        issueIds.add(id);
      }
    }
  }
  const reviewDetectionIds = result.detections
    .filter((detection) => issueIds.has(detection.id))
    .toSorted((left, right) => detectionPriority(left) - detectionPriority(right))
    .map(({ id }) => id);

  return { issues, readyToConfirm: issues.length === 0, reviewDetectionIds };
}

export function correctDetection(
  result: RecognitionResult,
  detectionId: string,
  correction: Pick<DetectedTile, "role" | "tile">,
): RecognitionResult {
  let found = false;
  const detections = result.detections.map((detection) => {
    if (detection.id !== detectionId) {
      return detection;
    }
    found = true;
    return { ...detection, confidence: 1, role: correction.role, tile: correction.tile };
  });
  if (!found) {
    throw new Error(`Detection ${detectionId} does not exist.`);
  }
  return { ...result, detections };
}

export function chooseWinningDetection(
  result: RecognitionResult,
  detectionId: string,
): RecognitionResult {
  const selected = result.detections.find(({ id }) => id === detectionId);
  if (selected === undefined) {
    throw new Error(`Detection ${detectionId} does not exist.`);
  }
  if (selected.role === "dora" || selected.role === "ura" || selected.role === "meld") {
    throw new Error("Only a concealed hand tile can be marked as the winning tile.");
  }
  return {
    ...result,
    detections: result.detections.map((detection) => ({
      ...detection,
      confidence: detection.id === detectionId ? 1 : detection.confidence,
      role:
        detection.id === detectionId
          ? "winning"
          : detection.role === "winning"
            ? "concealed"
            : detection.role,
    })),
  };
}
