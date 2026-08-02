/**
 * The fu table, as data.
 *
 * The scorer builds a hand's fu audit from these same rows, so the reference
 * cannot list a value the scorer does not award, or word a line differently
 * from the one a player reads underneath their own score.
 *
 * Two amounts are a ruleset decision rather than a fixed rule and are described
 * rather than fixed here: the pair that is both your seat wind and the round
 * wind, and whether an open hand with no other minipoints rounds to 30.
 */
export interface FuReference {
  /** The amount, or null when the profile decides it. */
  readonly fu: number | null;
  /** The exact wording the score panel uses for this row. */
  readonly reason: string;
  /** Where it applies, in one line. */
  readonly note: string;
}

export type GroupKindForFu = "quad" | "triplet";
export type GroupTileKindForFu = "inside" | "terminal/honour";

/** One row of the triplet-and-quad table, and the value the scorer awards. */
export interface GroupFuReference {
  readonly concealed: boolean;
  readonly fu: number;
  readonly kind: GroupKindForFu;
  readonly reason: string;
  readonly tileKind: GroupTileKindForFu;
}

function groupRow(
  kind: GroupKindForFu,
  tileKind: GroupTileKindForFu,
  concealed: boolean,
  fu: number,
): GroupFuReference {
  return {
    concealed,
    fu,
    kind,
    // Assembled the way the scorer used to assemble it inline, so the audit a
    // player reads and the table they can look up are the same sentence.
    reason: `${concealed ? "Concealed" : "Melded"} ${tileKind} ${kind}`,
    tileKind,
  };
}

export const groupFuCatalog: readonly GroupFuReference[] = [
  groupRow("triplet", "inside", false, 2),
  groupRow("triplet", "inside", true, 4),
  groupRow("triplet", "terminal/honour", false, 4),
  groupRow("triplet", "terminal/honour", true, 8),
  groupRow("quad", "inside", false, 8),
  groupRow("quad", "inside", true, 16),
  groupRow("quad", "terminal/honour", false, 16),
  groupRow("quad", "terminal/honour", true, 32),
];

export function groupFuReference(
  kind: GroupKindForFu,
  tileKind: GroupTileKindForFu,
  concealed: boolean,
): GroupFuReference {
  const row = groupFuCatalog.find(
    (entry) => entry.kind === kind && entry.tileKind === tileKind && entry.concealed === concealed,
  );
  if (row === undefined) {
    throw new Error(`No fu row for a ${concealed ? "concealed" : "melded"} ${tileKind} ${kind}.`);
  }
  return row;
}

/** Everything that is not a triplet or a quad. */
export const fuCatalog: readonly FuReference[] = [
  { fu: 20, note: "Every standard hand starts here.", reason: "Winning hand" },
  {
    fu: 10,
    note: "Won on a discard with no called sets.",
    reason: "Closed hand won by ron",
  },
  { fu: 2, note: "Drawn yourself. Never together with pinfu.", reason: "Self-draw" },
  {
    fu: 2,
    note: "A pair of dragons, of your seat wind, or of the round wind.",
    reason: "Value honour pair",
  },
  {
    fu: null,
    note: "A pair that is both your seat wind and the round wind: 2 or 4 by ruleset.",
    reason: "Double wind pair",
  },
  { fu: 2, note: "Waiting on the pair.", reason: "tanki wait" },
  { fu: 2, note: "Waiting between two tiles.", reason: "kanchan wait" },
  { fu: 2, note: "Waiting on the end of a 1-2 or 8-9.", reason: "penchan wait" },
  {
    fu: 10,
    note: "An open hand that earned nothing above is scored as 30 fu.",
    reason: "Open hand with no other minipoints",
  },
  { fu: 25, note: "Seven pairs is a flat 25 and takes nothing else.", reason: "Seven pairs" },
];
