import type { DetectedTile, RecognitionResult } from "@richii/vision";

import { inspectFrameExposure, inspectLocatedCapture } from "./capture-quality";
import type { CaptureQualityIssueKind } from "./capture-quality";
import { classifyBatchLogits } from "./classifier-output";
import { locateGuidedTiles } from "./guided-layout";
import type { PixelFrame } from "./guided-layout";
import {
  combineTileTensors,
  cropTileTensor,
  tileTensorHeight,
  tileTensorWidth,
} from "./tile-tensor";

export const guidedRecognitionModelVersion = "guided-crop-v1-0fc698d5";

export class GuidedRecognitionError extends Error {
  readonly code: CaptureQualityIssueKind | "layout";

  constructor(code: CaptureQualityIssueKind | "layout", message: string) {
    super(message);
    this.code = code;
    this.name = "GuidedRecognitionError";
  }
}

export async function recognizePixelFrame(
  frame: PixelFrame,
  runClassifier: (
    tensor: Float32Array,
    dimensions: readonly [number, 3, number, number],
  ) => Promise<Float32Array>,
): Promise<RecognitionResult> {
  const exposureIssue = inspectFrameExposure(frame);
  if (exposureIssue !== null) {
    throw new GuidedRecognitionError(exposureIssue.kind, exposureIssue.message);
  }
  const layout = locateGuidedTiles(frame);
  if (layout.kind === "failure") {
    throw new GuidedRecognitionError("layout", layout.message);
  }
  const qualityIssue = inspectLocatedCapture(frame, layout);
  if (qualityIssue !== null) {
    throw new GuidedRecognitionError(qualityIssue.kind, qualityIssue.message);
  }
  const bounds = [...layout.hand, layout.dora];
  const batch = combineTileTensors(bounds.map((item) => cropTileTensor(frame, item)));
  const logits = await runClassifier(batch, [bounds.length, 3, tileTensorHeight, tileTensorWidth]);
  const classifications = classifyBatchLogits(logits, bounds.length);
  const detections: DetectedTile[] = classifications.map((classification, index) => {
    const isDora = index === layout.hand.length;
    const isWinning = index === layout.winningIndex;
    const role = isDora ? "dora" : isWinning ? "winning" : "concealed";
    return {
      alternatives: classification.alternatives,
      bounds: bounds[index] ?? { height: 0, width: 0, x: 0, y: 0 },
      confidence:
        isWinning && !layout.winningRoleCertain
          ? Math.min(0.5, classification.confidence)
          : classification.confidence,
      id: isDora ? "dora-0" : `hand-${index}`,
      role,
      tile: classification.tile,
    };
  });
  return { detections, modelVersion: guidedRecognitionModelVersion };
}
