import type {
  DetectedTile,
  DetectionRole,
  NormalizedBounds,
  RecognitionResult,
} from "@richii/vision";

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
  // One slot per physical tile face, in a stable order: concealed hand, then the
  // called melds (grouped), then the dora. Meld ids encode their group so the
  // draft can reassemble each set.
  interface Slot {
    readonly bounds: NormalizedBounds;
    readonly id: string;
    readonly role: DetectionRole;
    readonly winning: boolean;
  }
  const slots: Slot[] = [];
  layout.concealed.forEach((bounds, index) => {
    const winning = index === layout.winningIndex;
    slots.push({ bounds, id: `hand-${index}`, role: winning ? "winning" : "concealed", winning });
  });
  layout.melds.forEach((meld, groupIndex) => {
    meld.forEach((bounds, tileIndex) => {
      slots.push({ bounds, id: `meld-${groupIndex}-${tileIndex}`, role: "meld", winning: false });
    });
  });
  slots.push({ bounds: layout.dora, id: "dora-0", role: "dora", winning: false });

  const batch = combineTileTensors(slots.map((slot) => cropTileTensor(frame, slot.bounds)));
  const logits = await runClassifier(batch, [slots.length, 3, tileTensorHeight, tileTensorWidth]);
  const classifications = classifyBatchLogits(logits, slots.length);
  const detections: DetectedTile[] = slots.map((slot, index) => {
    const classification = classifications[index];
    const confidence = classification?.confidence ?? 0;
    return {
      alternatives: classification?.alternatives ?? [],
      bounds: slot.bounds,
      confidence:
        slot.winning && !layout.winningRoleCertain ? Math.min(0.5, confidence) : confidence,
      id: slot.id,
      role: slot.role,
      tile: classification?.tile ?? null,
    };
  });
  return { detections, modelVersion: guidedRecognitionModelVersion };
}
