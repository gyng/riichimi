import { canonicalTileIds, redFiveIds } from "@richii/score-core";
import type { TileId } from "@richii/score-core";

export type RecognitionClass = TileId | "unknown";

export interface RecognitionModelManifest {
  readonly artifact: {
    readonly bytes: number;
    readonly format: "onnx";
    readonly sha256: string;
    readonly url: `https://${string}`;
  };
  readonly classes: readonly RecognitionClass[];
  readonly id: string;
  readonly input: {
    readonly colorSpace: "rgb";
    readonly height: number;
    readonly layout: "nchw";
    readonly width: number;
  };
  readonly license: {
    readonly sourceUrl: `https://${string}`;
    readonly spdxId: string;
  };
  readonly metrics: {
    readonly datasetId: string;
    readonly evaluatedHands: number;
    readonly exactHandAccuracy: number;
    readonly perTileTop1Accuracy: number;
  };
  readonly schemaVersion: 1;
  readonly version: string;
}

export type ModelReleaseIssueCode =
  | "EXACT_HAND_ACCURACY"
  | "INCOMPLETE_CLASSES"
  | "INVALID_ARTIFACT"
  | "INVALID_INPUT"
  | "INVALID_LICENSE"
  | "INVALID_MANIFEST"
  | "PER_TILE_ACCURACY"
  | "SMALL_EVALUATION";

export interface ModelReleaseIssue {
  readonly code: ModelReleaseIssueCode;
  readonly message: string;
}

export interface ModelReleaseThresholds {
  readonly exactHandAccuracy: number;
  readonly minimumEvaluatedHands: number;
  readonly perTileTop1Accuracy: number;
}

export const guidedScannerReleaseThresholds: ModelReleaseThresholds = {
  exactHandAccuracy: 0.93,
  minimumEvaluatedHands: 500,
  perTileTop1Accuracy: 0.995,
};

export const recognitionModelClasses: readonly RecognitionClass[] = [
  ...canonicalTileIds,
  ...redFiveIds,
  "unknown",
];

function isProbability(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function invalidManifestIssues(manifest: RecognitionModelManifest): ModelReleaseIssue[] {
  const issues: ModelReleaseIssue[] = [];
  if (
    manifest.schemaVersion !== 1 ||
    manifest.id.trim().length === 0 ||
    manifest.version.trim().length === 0 ||
    manifest.metrics.datasetId.trim().length === 0
  ) {
    issues.push({
      code: "INVALID_MANIFEST",
      message: "Model identity, version, schema, and evaluation dataset are required.",
    });
  }
  if (
    manifest.artifact.format !== "onnx" ||
    !Number.isInteger(manifest.artifact.bytes) ||
    manifest.artifact.bytes <= 0 ||
    !/^[a-f\d]{64}$/.test(manifest.artifact.sha256) ||
    !manifest.artifact.url.startsWith("https://")
  ) {
    issues.push({
      code: "INVALID_ARTIFACT",
      message: "The ONNX artifact needs a positive byte size, HTTPS URL, and lowercase SHA-256.",
    });
  }
  if (
    !Number.isInteger(manifest.input.height) ||
    !Number.isInteger(manifest.input.width) ||
    manifest.input.height <= 0 ||
    manifest.input.width <= 0 ||
    manifest.input.colorSpace !== "rgb" ||
    manifest.input.layout !== "nchw"
  ) {
    issues.push({
      code: "INVALID_INPUT",
      message: "Model input must be a positive RGB NCHW image size.",
    });
  }
  if (
    manifest.license.spdxId.trim().length === 0 ||
    !manifest.license.sourceUrl.startsWith("https://")
  ) {
    issues.push({
      code: "INVALID_LICENSE",
      message: "A redistribution license and HTTPS provenance URL are required.",
    });
  }
  if (
    !isProbability(manifest.metrics.exactHandAccuracy) ||
    !isProbability(manifest.metrics.perTileTop1Accuracy)
  ) {
    issues.push({
      code: "INVALID_MANIFEST",
      message: "Recognition accuracy metrics must be probabilities from zero to one.",
    });
  }
  return issues;
}

export function evaluateRecognitionModelRelease(
  manifest: RecognitionModelManifest,
  thresholds: ModelReleaseThresholds = guidedScannerReleaseThresholds,
): readonly ModelReleaseIssue[] {
  const issues = invalidManifestIssues(manifest);
  const availableClasses = new Set(manifest.classes);
  const missingClasses = recognitionModelClasses.filter((tile) => !availableClasses.has(tile));
  if (missingClasses.length > 0) {
    issues.push({
      code: "INCOMPLETE_CLASSES",
      message: `Recognition classes are missing: ${missingClasses.join(", ")}.`,
    });
  }
  if (manifest.metrics.evaluatedHands < thresholds.minimumEvaluatedHands) {
    issues.push({
      code: "SMALL_EVALUATION",
      message: `Evaluate at least ${thresholds.minimumEvaluatedHands} representative hands.`,
    });
  }
  if (manifest.metrics.perTileTop1Accuracy < thresholds.perTileTop1Accuracy) {
    issues.push({
      code: "PER_TILE_ACCURACY",
      message: `Per-tile top-1 accuracy must reach ${thresholds.perTileTop1Accuracy}.`,
    });
  }
  if (manifest.metrics.exactHandAccuracy < thresholds.exactHandAccuracy) {
    issues.push({
      code: "EXACT_HAND_ACCURACY",
      message: `Exact-hand accuracy must reach ${thresholds.exactHandAccuracy}.`,
    });
  }
  return issues;
}
