import { auditTileInventory } from "../domain/tile-inventory";
import { groupTiles } from "../domain/meld";
import type { DeclaredMeld, StandardGroup } from "../domain/meld";
import type { HandValidationIssue, ScoreHandInput, WinContext } from "../domain/hand";
import { canonicalizeTile, isRedFive, tileRank, tileSuit } from "../domain/tile";
import type { CanonicalTileId, TileId } from "../domain/tile";

export interface NormalizedHand {
  readonly allHandTiles: readonly CanonicalTileId[];
  readonly concealedTiles: readonly CanonicalTileId[];
  readonly context: WinContext;
  readonly doraIndicators: readonly CanonicalTileId[];
  readonly isClosed: boolean;
  readonly melds: readonly StandardGroup[];
  readonly originalHandTiles: readonly TileId[];
  readonly rules: ScoreHandInput["rules"];
  readonly uraDoraIndicators: readonly CanonicalTileId[];
  readonly winningTile: CanonicalTileId;
}

export type NormalizeHandResult =
  | { readonly hand: NormalizedHand; readonly issues: readonly [] }
  | { readonly hand: null; readonly issues: readonly HandValidationIssue[] };

function issue(code: HandValidationIssue["code"], message: string): HandValidationIssue {
  return { code, message };
}

function normalizeMeld(meld: DeclaredMeld): StandardGroup | null {
  if (meld.kind === "sequence") {
    const tiles = meld.tiles.map(canonicalizeTile).toSorted((left, right) => {
      const leftRank = tileRank(left) ?? 0;
      const rightRank = tileRank(right) ?? 0;
      return leftRank - rightRank;
    });
    const [first, second, third] = tiles;

    if (
      first === undefined ||
      second === undefined ||
      third === undefined ||
      tileSuit(first) === null ||
      tileSuit(first) !== tileSuit(second) ||
      tileSuit(first) !== tileSuit(third) ||
      tileRank(second) !== (tileRank(first) ?? 0) + 1 ||
      tileRank(third) !== (tileRank(first) ?? 0) + 2
    ) {
      return null;
    }

    return { kind: "sequence", open: true, tiles: [first, second, third] };
  }

  return { kind: meld.kind, open: meld.open, tile: canonicalizeTile(meld.tile) };
}

function validateContext(context: WinContext, isClosed: boolean): readonly HandValidationIssue[] {
  const issues: HandValidationIssue[] = [];
  const hasRiichi = context.riichi !== "none";

  if (!Number.isInteger(context.honba) || context.honba < 0) {
    issues.push(issue("INVALID_CONTEXT", "Honba must be a non-negative whole number."));
  }

  if (!Number.isInteger(context.riichiSticks) || context.riichiSticks < 0) {
    issues.push(issue("INVALID_CONTEXT", "Riichi sticks must be a non-negative whole number."));
  }

  if (hasRiichi && !isClosed) {
    issues.push(issue("INVALID_CONTEXT", "An open hand cannot declare riichi."));
  }

  if (context.ippatsu && !hasRiichi) {
    issues.push(issue("INVALID_CONTEXT", "Ippatsu requires riichi or double riichi."));
  }

  if (context.chankan && context.method !== "ron") {
    issues.push(issue("INVALID_CONTEXT", "Robbing a quad is scored as a ron win."));
  }

  if (context.rinshan && context.method !== "tsumo") {
    issues.push(issue("INVALID_CONTEXT", "After a quad is scored as a tsumo win."));
  }

  if (context.lastTile === "haitei" && context.method !== "tsumo") {
    issues.push(issue("INVALID_CONTEXT", "Haitei requires a tsumo win."));
  }

  if (context.lastTile === "houtei" && context.method !== "ron") {
    issues.push(issue("INVALID_CONTEXT", "Houtei requires a ron win."));
  }

  if (context.rinshan && context.lastTile !== "none") {
    issues.push(issue("INVALID_CONTEXT", "Rinshan and last-tile yaku cannot be combined."));
  }

  if (context.chankan && context.rinshan) {
    issues.push(issue("INVALID_CONTEXT", "Chankan and rinshan cannot describe the same win."));
  }

  if (context.firstTurn !== "none" && !isClosed) {
    issues.push(issue("INVALID_CONTEXT", "First-turn win yaku require a closed hand."));
  }

  if (
    context.firstTurn === "tenhou" &&
    (context.method !== "tsumo" || context.seatWind !== "east")
  ) {
    issues.push(
      issue("INVALID_CONTEXT", "Tenhou requires East to win by tsumo on the initial deal."),
    );
  }

  if (
    context.firstTurn === "chiihou" &&
    (context.method !== "tsumo" || context.seatWind === "east")
  ) {
    issues.push(issue("INVALID_CONTEXT", "Chiihou requires a non-East player to win by tsumo."));
  }

  if (context.firstTurn === "renhou" && (context.method !== "ron" || context.seatWind === "east")) {
    issues.push(issue("INVALID_CONTEXT", "Renhou requires a non-East player to win by ron."));
  }

  if (
    context.firstTurn !== "none" &&
    (context.chankan ||
      context.rinshan ||
      context.lastTile !== "none" ||
      hasRiichi ||
      context.ippatsu)
  ) {
    issues.push(
      issue("INVALID_CONTEXT", "First-turn win yaku cannot combine with later-hand event flags."),
    );
  }

  return issues;
}

export function normalizeHand(input: ScoreHandInput): NormalizeHandResult {
  const issues: HandValidationIssue[] = [];

  if (input.melds.length > 4) {
    issues.push(issue("TOO_MANY_MELDS", "A hand cannot contain more than four groups."));
  }

  const melds: StandardGroup[] = [];

  for (const meld of input.melds) {
    const normalized = normalizeMeld(meld);

    if (normalized === null) {
      issues.push(
        issue("INVALID_MELD", "A declared sequence must be consecutive and in one suit."),
      );
    } else {
      melds.push(normalized);
    }
  }

  const concealedTiles = input.concealedTiles.map(canonicalizeTile);
  const winningTile = canonicalizeTile(input.winningTile);
  const logicalTileCount = concealedTiles.length + input.melds.length * 3;

  if (logicalTileCount !== 14) {
    issues.push(
      issue(
        "HAND_SIZE",
        `A winning hand needs 14 logical tiles; this hand contains ${logicalTileCount}.`,
      ),
    );
  }

  if (!concealedTiles.includes(winningTile)) {
    issues.push(
      issue("WINNING_TILE_MISSING", "The winning tile must be present among the concealed tiles."),
    );
  }

  const originalMeldTiles = input.melds.flatMap((meld) => {
    if (meld.kind === "sequence") {
      return [...meld.tiles];
    }

    return Array.from({ length: meld.kind === "quad" ? 4 : 3 }, () => meld.tile);
  });
  const everyPhysicalTile = [
    ...input.concealedTiles,
    ...originalMeldTiles,
    ...input.doraIndicators,
    ...input.uraDoraIndicators,
  ];

  if (!input.rules.redFives && everyPhysicalTile.some(isRedFive)) {
    issues.push(issue("RED_FIVE_NOT_ALLOWED", `${input.rules.label} does not use red fives.`));
  }

  for (const inventoryIssue of auditTileInventory(everyPhysicalTile).issues) {
    issues.push(
      issue(
        "IMPOSSIBLE_TILE_COUNT",
        `${inventoryIssue.tile} appears ${inventoryIssue.actual} times; only four copies exist.`,
      ),
    );
  }

  const isClosed = melds.every(({ open }) => !open);
  issues.push(...validateContext(input.context, isClosed));

  if (input.uraDoraIndicators.length > 0 && input.context.riichi === "none") {
    issues.push(issue("INVALID_CONTEXT", "Ura-dora indicators require a riichi declaration."));
  }

  if (issues.length > 0) {
    return { hand: null, issues };
  }

  const allHandTiles = [...concealedTiles, ...melds.flatMap(groupTiles)];

  return {
    hand: {
      allHandTiles,
      concealedTiles,
      context: input.context,
      doraIndicators: input.doraIndicators.map(canonicalizeTile),
      isClosed,
      melds,
      originalHandTiles: [...input.concealedTiles, ...originalMeldTiles],
      rules: input.rules,
      uraDoraIndicators: input.uraDoraIndicators.map(canonicalizeTile),
      winningTile,
    },
    issues: [],
  };
}
