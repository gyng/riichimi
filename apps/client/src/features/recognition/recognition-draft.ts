import { canonicalTileIds, redFiveIds } from "@richii/score-core";
import type { TileId } from "@richii/score-core";

export interface RecognitionDraft {
  readonly concealedTiles: readonly TileId[];
  readonly doraIndicators: readonly [TileId];
  readonly modelVersion: string;
  readonly reviewedCount: number;
  readonly winningIndex: number;
}

const tileIds = new Set<string>([...canonicalTileIds, ...redFiveIds]);

function isTile(value: string): value is TileId {
  return tileIds.has(value);
}

export function parseRecognitionDraft(input: {
  readonly dora?: string | undefined;
  readonly modelVersion?: string | undefined;
  readonly reviewedCount?: string | undefined;
  readonly tiles?: string | undefined;
  readonly winningIndex?: string | undefined;
}): RecognitionDraft | undefined {
  const tiles = input.tiles?.split(",") ?? [];
  const dora = input.dora;
  const winningIndex = Number(input.winningIndex);
  const reviewedCount = Number(input.reviewedCount);
  if (
    tiles.length !== 14 ||
    !tiles.every(isTile) ||
    dora === undefined ||
    !isTile(dora) ||
    !Number.isInteger(winningIndex) ||
    winningIndex < 0 ||
    winningIndex > 13 ||
    !Number.isInteger(reviewedCount) ||
    reviewedCount < 0 ||
    input.modelVersion === undefined ||
    input.modelVersion.trim().length === 0
  ) {
    return undefined;
  }
  return {
    concealedTiles: tiles,
    doraIndicators: [dora],
    modelVersion: input.modelVersion,
    reviewedCount,
    winningIndex,
  };
}
