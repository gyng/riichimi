import type { TileId } from "@richii/score-core";
import { recognitionModelClasses } from "@richii/vision";

export interface ClassifiedTile {
  readonly alternatives: readonly { readonly confidence: number; readonly tile: TileId }[];
  readonly confidence: number;
  readonly tile: TileId | null;
}

function probabilities(logits: readonly number[]): readonly number[] {
  const maximum = Math.max(...logits);
  const exponentials = logits.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / total);
}

export function classifyBatchLogits(
  logits: Float32Array,
  batchSize: number,
): readonly ClassifiedTile[] {
  const classCount = recognitionModelClasses.length;
  if (batchSize <= 0 || logits.length !== batchSize * classCount) {
    throw new RangeError("Classifier logits must match the requested batch and model classes.");
  }
  return Array.from({ length: batchSize }, (_, batchIndex) => {
    const start = batchIndex * classCount;
    const scores = probabilities(Array.from(logits.slice(start, start + classCount)));
    const ranked = scores
      .map((confidence, index) => ({ confidence, label: recognitionModelClasses[index] }))
      .filter(
        (candidate): candidate is { confidence: number; label: TileId } =>
          candidate.label !== undefined && candidate.label !== "unknown",
      )
      .toSorted((left, right) => right.confidence - left.confidence);
    const topClassIndex = scores.indexOf(Math.max(...scores));
    const topClass = recognitionModelClasses[topClassIndex];
    return {
      alternatives: ranked.slice(0, 3).map(({ confidence, label }) => ({
        confidence,
        tile: label,
      })),
      confidence: scores[topClassIndex] ?? 0,
      tile: topClass === undefined || topClass === "unknown" ? null : topClass,
    };
  });
}
