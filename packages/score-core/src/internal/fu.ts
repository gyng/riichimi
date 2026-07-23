import type { StandardGroup } from "../domain/meld";
import type { FuBreakdown, FuItem, Yaku } from "../domain/score";
import { isTerminalOrHonor } from "../domain/tile";
import type { StandardInterpretation } from "./hand-analysis";
import type { NormalizedHand } from "./normalize-hand";

function groupFu(
  group: Extract<StandardGroup, { readonly kind: "quad" | "triplet" }>,
  concealedForFu: boolean,
): number {
  const usesTerminalOrHonour = isTerminalOrHonor(group.tile);

  if (group.kind === "triplet") {
    return (usesTerminalOrHonour ? 4 : 2) * (concealedForFu ? 2 : 1);
  }

  return (usesTerminalOrHonour ? 16 : 8) * (concealedForFu ? 2 : 1);
}

export function sevenPairsFu(): FuBreakdown {
  return {
    items: [{ fu: 25, reason: "Seven pairs" }],
    rounded: 25,
    unrounded: 25,
  };
}

export function calculateStandardFu(
  hand: NormalizedHand,
  interpretation: StandardInterpretation,
  yaku: readonly Yaku[],
): FuBreakdown {
  const items: FuItem[] = [{ fu: 20, reason: "Winning hand" }];
  const hasPinfu = yaku.some(({ id }) => id === "pinfu");

  if (hand.context.method === "ron" && hand.isClosed) {
    items.push({ fu: 10, reason: "Closed hand won by ron" });
  }

  if (hand.context.method === "tsumo" && !hasPinfu) {
    items.push({ fu: 2, reason: "Self-draw" });
  }

  const pair = interpretation.decomposition.pair;

  const isDragonPair = pair === "white" || pair === "green" || pair === "red";
  const isSeatWindPair = pair === hand.context.seatWind;
  const isRoundWindPair = pair === hand.context.roundWind;

  if (isDragonPair) {
    items.push({ fu: 2, reason: "Value honour pair" });
  } else if (isSeatWindPair && isRoundWindPair) {
    // A pair that is both winds is worth 4 fu under some rulesets and 2 under
    // others, so the amount is a profile decision rather than a fixed rule.
    items.push({ fu: hand.rules.doubleWindPairFu, reason: "Double wind pair" });
  } else if (isSeatWindPair || isRoundWindPair) {
    items.push({ fu: 2, reason: "Value honour pair" });
  }

  const completedGroupIndex =
    interpretation.placement.concealedGroupIndex === null
      ? null
      : hand.melds.length + interpretation.placement.concealedGroupIndex;

  interpretation.groups.forEach((group, groupIndex) => {
    if (group.kind === "sequence") {
      return;
    }

    const openedByRon =
      hand.context.method === "ron" &&
      group.kind === "triplet" &&
      groupIndex === completedGroupIndex;
    const concealedForFu = !group.open && !openedByRon;
    const fu = groupFu(group, concealedForFu);
    const openness = concealedForFu ? "Concealed" : "Melded";
    const groupName = group.kind === "quad" ? "quad" : "triplet";
    const tileKind = isTerminalOrHonor(group.tile) ? "terminal/honour" : "inside";
    items.push({ fu, reason: `${openness} ${tileKind} ${groupName}` });
  });

  if (
    interpretation.placement.wait === "tanki" ||
    interpretation.placement.wait === "kanchan" ||
    interpretation.placement.wait === "penchan"
  ) {
    items.push({ fu: 2, reason: `${interpretation.placement.wait} wait` });
  }

  let unrounded = items.reduce((total, item) => total + item.fu, 0);

  if (!hand.isClosed && unrounded === 20) {
    items.push({ fu: 10, reason: "Open hand with no other minipoints" });
    unrounded += 10;
  }

  return {
    items,
    rounded: Math.ceil(unrounded / 10) * 10,
    unrounded,
  };
}
