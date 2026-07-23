import type { DetectedTile, RecognitionResult } from "@richii/vision";

import { classifyBatchLogits } from "./classifier-output";
import { locateGuidedTiles } from "./guided-layout";
import type { PixelFrame } from "./guided-layout";
import {
  combineTileTensors,
  cropTileTensor,
  tileTensorHeight,
  tileTensorWidth,
} from "./tile-tensor";

export const guidedRecognitionModelVersion = "guided-crop-v0-078ca926";

export class GuidedRecognitionError extends Error {
  constructor(message: string) {
    super(message);
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
  const layout = locateGuidedTiles(frame);
  if (layout.kind === "failure") {
    throw new GuidedRecognitionError(layout.message);
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
