import type { TileId } from "@richii/score-core";

export interface NormalizedBounds {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface DetectedTile {
  readonly alternatives: readonly TileCandidate[];
  readonly bounds: NormalizedBounds;
  readonly confidence: number;
  readonly id: string;
  readonly role: DetectionRole;
  readonly tile: TileId | null;
}

export interface TileCandidate {
  readonly confidence: number;
  readonly tile: TileId;
}

export type DetectionRole = "concealed" | "dora" | "meld" | "unknown" | "ura" | "winning";

export interface ImageFrame {
  readonly height: number;
  readonly uri: string;
  readonly width: number;
}

export interface RecognitionResult {
  readonly detections: readonly DetectedTile[];
  readonly modelVersion: string;
}

export type RecognitionIssue =
  | {
      readonly detectionIds: readonly string[];
      readonly kind: "impossible-count";
      readonly message: string;
      readonly tile: TileId;
    }
  | {
      readonly actual: number;
      readonly expected: 1;
      readonly kind: "winning-tile-count";
      readonly message: string;
    }
  | {
      readonly detectionId: string;
      readonly kind: "uncertain" | "unknown-tile" | "unknown-role";
      readonly message: string;
    };

export interface RecognitionReview {
  readonly issues: readonly RecognitionIssue[];
  readonly readyToConfirm: boolean;
  readonly reviewDetectionIds: readonly string[];
}

export interface TileRecognitionPort {
  recognize(frame: ImageFrame): Promise<RecognitionResult>;
}
