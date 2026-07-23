import type { NormalizedBounds } from "@richii/vision";

import type { GuidedLayoutResult, PixelFrame } from "./guided-layout";

export type CaptureQualityIssueKind = "blur" | "crop" | "glare" | "perspective";

export interface CaptureQualityIssue {
  readonly kind: CaptureQualityIssueKind;
  readonly message: string;
}

const clippedPixelRatioLimit = 0.18;
const laplacianVarianceMinimum = 35;
const edgeMargin = 0.008;
const maximumHeightScale = 1.4;
const maximumAspectRatioSpread = 0.3;

function luminance(data: Uint8ClampedArray, pixelIndex: number): number {
  const offset = pixelIndex * 4;
  return (
    ((data[offset] ?? 0) * 77 + (data[offset + 1] ?? 0) * 150 + (data[offset + 2] ?? 0) * 29) / 256
  );
}

function clippedPixelRatio(frame: PixelFrame): number {
  let clipped = 0;
  const pixels = frame.width * frame.height;
  for (let pixelIndex = 0; pixelIndex < pixels; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    if (
      (frame.data[offset] ?? 0) >= 248 &&
      (frame.data[offset + 1] ?? 0) >= 248 &&
      (frame.data[offset + 2] ?? 0) >= 248
    ) {
      clipped += 1;
    }
  }
  return clipped / pixels;
}

function laplacianVariance(frame: PixelFrame): number {
  let count = 0;
  let sum = 0;
  let squaredSum = 0;
  for (let y = 1; y < frame.height - 1; y += 2) {
    for (let x = 1; x < frame.width - 1; x += 2) {
      const center = y * frame.width + x;
      const value =
        luminance(frame.data, center - frame.width) +
        luminance(frame.data, center + frame.width) +
        luminance(frame.data, center - 1) +
        luminance(frame.data, center + 1) -
        luminance(frame.data, center) * 4;
      count += 1;
      sum += value;
      squaredSum += value * value;
    }
  }
  if (count === 0) {
    return 0;
  }
  const mean = sum / count;
  return squaredSum / count - mean * mean;
}

function touchesFrameEdge(bounds: NormalizedBounds): boolean {
  return (
    bounds.x <= edgeMargin ||
    bounds.y <= edgeMargin ||
    bounds.x + bounds.width >= 1 - edgeMargin ||
    bounds.y + bounds.height >= 1 - edgeMargin
  );
}

function perspectiveIsExcessive(bounds: readonly NormalizedBounds[]): boolean {
  const heights = bounds.map(({ height }) => height);
  const aspectRatios = bounds.map(({ height, width }) => width / height);
  const minimumHeight = Math.min(...heights);
  const heightScale = Math.max(...heights) / minimumHeight;
  const aspectRatioSpread = Math.max(...aspectRatios) - Math.min(...aspectRatios);
  return heightScale > maximumHeightScale || aspectRatioSpread > maximumAspectRatioSpread;
}

export function inspectFrameExposure(frame: PixelFrame): CaptureQualityIssue | null {
  if (clippedPixelRatio(frame) > clippedPixelRatioLimit) {
    return {
      kind: "glare",
      message:
        "Strong glare is washing out the tile faces. Move the light or camera until every symbol is evenly visible.",
    };
  }
  return null;
}

export function inspectLocatedCapture(
  frame: PixelFrame,
  layout: Extract<GuidedLayoutResult, { kind: "success" }>,
): CaptureQualityIssue | null {
  const bounds = [...layout.concealed, ...layout.melds.flat(), layout.dora];
  if (bounds.some(touchesFrameEdge)) {
    return {
      kind: "crop",
      message:
        "One or more tiles touch the photo edge. Keep every tile fully inside the guide and retake it.",
    };
  }
  if (perspectiveIsExcessive(layout.concealed)) {
    return {
      kind: "perspective",
      message:
        "The tile row is too steeply angled for a reliable read. Hold the camera more directly above the faces.",
    };
  }
  if (laplacianVariance(frame) < laplacianVarianceMinimum) {
    return {
      kind: "blur",
      message:
        "The photo is too blurry to read safely. Hold the camera steady, add light, and retake it.",
    };
  }
  return null;
}
