import type {
  CaptureLayout,
  DetectedTile,
  DetectionRole,
  NormalizedBounds,
  RecognitionResult,
} from "@riichimi/vision";

import { inspectFrameExposure, inspectFrameTilt, inspectLocatedCapture } from "./capture-quality";
import { deskewFrame } from "./deskew";
import type { CaptureQualityIssueKind } from "./capture-quality";
import { classifyBatchLogits } from "./classifier-output";
import { locateGuidedTiles } from "./guided-layout";
import type { PixelFrame } from "./guided-layout";
import { locateSingleRowTiles } from "./single-row-layout";
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
  captureLayout: CaptureLayout = "guided",
): Promise<RecognitionResult> {
  const exposureIssue = inspectFrameExposure(frame);
  if (exposureIssue !== null) {
    throw new GuidedRecognitionError(exposureIssue.kind, exposureIssue.message);
  }
  // Level the photo before reading it. Everything downstream works by scanline,
  // so a row turned even a few degrees is never found — and people photograph a
  // table from where they are sitting, so most photos are turned.
  const deskewed = deskewFrame(frame);
  const reading = deskewed.frame;
  const layout =
    captureLayout === "natural" ? locateSingleRowTiles(reading) : locateGuidedTiles(reading);
  if (layout.kind === "failure") {
    // Turned so far that levelling could not rescue it. The frame can still say
    // so, which is a fix a player can act on where "retry with another photo"
    // is a dead end.
    const tiltIssue = inspectFrameTilt(frame);
    if (tiltIssue !== null) {
      throw new GuidedRecognitionError(tiltIssue.kind, tiltIssue.message);
    }
    throw new GuidedRecognitionError("layout", layout.message);
  }
  const qualityIssue = inspectLocatedCapture(reading, layout);
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

  // Cropped from the levelled frame — a tile face read square is what the
  // classifier was trained on — while every bound handed back is mapped to the
  // photo the player took, because that is what the review overlay draws on.
  const batch = combineTileTensors(slots.map((slot) => cropTileTensor(reading, slot.bounds)));
  const logits = await runClassifier(batch, [slots.length, 3, tileTensorHeight, tileTensorWidth]);
  const classifications = classifyBatchLogits(logits, slots.length);
  const detections: DetectedTile[] = slots.map((slot, index) => {
    const classification = classifications[index];
    const confidence = classification?.confidence ?? 0;
    return {
      alternatives: classification?.alternatives ?? [],
      bounds: deskewed.toOriginal(slot.bounds),
      confidence:
        slot.winning && !layout.winningRoleCertain ? Math.min(0.5, confidence) : confidence,
      id: slot.id,
      role: slot.role,
      tile: classification?.tile ?? null,
    };
  });
  return { detections, modelVersion: guidedRecognitionModelVersion };
}
