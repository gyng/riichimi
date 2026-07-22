import { canonicalTileIds, redFiveIds } from "@richii/score-core";
import { describe, expect, it } from "vitest";

import { evaluateRecognitionModelRelease, guidedScannerReleaseThresholds } from "./model-manifest";
import type { RecognitionModelManifest } from "./model-manifest";

function manifest(overrides: Partial<RecognitionModelManifest> = {}): RecognitionModelManifest {
  return {
    artifact: {
      bytes: 8_000_000,
      format: "onnx",
      sha256: "a".repeat(64),
      url: "https://models.richii.app/guided-v1.onnx",
    },
    classes: [...canonicalTileIds, ...redFiveIds, "unknown"],
    id: "richii-guided-physical-tiles",
    input: { colorSpace: "rgb", height: 640, layout: "nchw", width: 640 },
    license: { sourceUrl: "https://models.richii.app/LICENSE", spdxId: "Apache-2.0" },
    metrics: {
      datasetId: "richii-guided-eval-v1",
      evaluatedHands: 500,
      exactHandAccuracy: 0.95,
      perTileTop1Accuracy: 0.996,
    },
    schemaVersion: 1,
    version: "1.0.0",
    ...overrides,
  };
}

describe("recognition model release manifest", () => {
  it("accepts a complete, licensed artifact that clears every release threshold", () => {
    expect(evaluateRecognitionModelRelease(manifest())).toEqual([]);
  });

  it("reports incomplete class coverage and weak evaluation independently", () => {
    const issues = evaluateRecognitionModelRelease(
      manifest({
        classes: ["1m", "unknown"],
        metrics: {
          datasetId: "small-eval",
          evaluatedHands: 20,
          exactHandAccuracy: 0.7,
          perTileTop1Accuracy: 0.9,
        },
      }),
    );

    expect(issues.map(({ code }) => code)).toEqual([
      "INCOMPLETE_CLASSES",
      "SMALL_EVALUATION",
      "PER_TILE_ACCURACY",
      "EXACT_HAND_ACCURACY",
    ]);
  });

  it("rejects malformed artifact, input, license, identity, and metric metadata", () => {
    const issues = evaluateRecognitionModelRelease(
      manifest({
        artifact: { bytes: 0, format: "onnx", sha256: "BAD", url: "https://invalid" },
        id: "",
        input: { colorSpace: "rgb", height: 0, layout: "nchw", width: -1 },
        license: { sourceUrl: "https://invalid", spdxId: "" },
        metrics: {
          datasetId: "",
          evaluatedHands: guidedScannerReleaseThresholds.minimumEvaluatedHands,
          exactHandAccuracy: 2,
          perTileTop1Accuracy: Number.NaN,
        },
        version: "",
      }),
    );

    expect(issues.map(({ code }) => code)).toEqual([
      "INVALID_MANIFEST",
      "INVALID_ARTIFACT",
      "INVALID_INPUT",
      "INVALID_LICENSE",
      "INVALID_MANIFEST",
    ]);
  });
});
