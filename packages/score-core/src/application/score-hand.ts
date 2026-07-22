import type { ScoreHandInput } from "../domain/hand";
import type {
  DoraBreakdown,
  FuBreakdown,
  ScoreHandResult,
  ScoreSuccess,
  Yaku,
  Yakuman,
} from "../domain/score";
import { calculateStandardFu, sevenPairsFu } from "../internal/fu";
import {
  enumerateStandardInterpretations,
  isSevenPairs,
  isThirteenOrphans,
} from "../internal/hand-analysis";
import { normalizeHand } from "../internal/normalize-hand";
import type { NormalizedHand } from "../internal/normalize-hand";
import { calculateBasePoints, calculatePayments } from "../internal/payments";
import {
  countDora,
  evaluateSevenPairsYaku,
  evaluateStandardYaku,
  evaluateYakuman,
  renhouYaku,
} from "../internal/yaku";

interface CandidateInput {
  readonly dora: DoraBreakdown;
  readonly fu: FuBreakdown | null;
  readonly hand: NormalizedHand;
  readonly yaku: readonly Yaku[];
  readonly yakuman: readonly Yakuman[];
}

function createCandidate({ dora, fu, hand, yaku, yakuman }: CandidateInput): ScoreSuccess | null {
  const yakumanCount = yakuman.reduce((total, item) => total + item.value, 0);
  const yakuHan = yaku.reduce((total, item) => total + item.han, 0);

  if (yakumanCount === 0 && yakuHan === 0) {
    return null;
  }

  const han = yakumanCount > 0 ? null : yakuHan + dora.total;
  const scoredFu = yakumanCount > 0 ? null : fu;
  const { basePoints, limit } = calculateBasePoints(
    han ?? 0,
    scoredFu?.rounded ?? 0,
    yakumanCount,
    hand.rules,
  );
  const payments = calculatePayments(basePoints, hand.context);
  const riichiBonus = hand.context.riichiSticks * 1000;

  return {
    basePoints,
    dora: yakumanCount > 0 ? { dora: 0, redDora: 0, total: 0, uraDora: 0 } : dora,
    fu: scoredFu,
    han,
    kind: "success",
    limit,
    payments,
    riichiBonus,
    totalGain: payments.total + riichiBonus,
    yaku: yakumanCount > 0 ? [] : yaku,
    yakuman,
  };
}

function candidateValue(candidate: ScoreSuccess): readonly number[] {
  return [
    candidate.payments.total,
    candidate.yakuman.length,
    candidate.han ?? 0,
    candidate.fu?.rounded ?? 0,
  ];
}

function compareCandidates(left: ScoreSuccess, right: ScoreSuccess): number {
  const leftValue = candidateValue(left);
  const rightValue = candidateValue(right);

  for (let index = 0; index < leftValue.length; index += 1) {
    const difference = (rightValue[index] ?? 0) - (leftValue[index] ?? 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

export function scoreHand(input: ScoreHandInput): ScoreHandResult {
  const normalized = normalizeHand(input);

  if (normalized.hand === null) {
    return { issues: normalized.issues, kind: "invalid" };
  }

  const hand = normalized.hand;
  const dora = countDora(hand);
  const candidates: ScoreSuccess[] = [];
  const sevenPairs = isSevenPairs(hand);
  const thirteenOrphans = isThirteenOrphans(hand);
  const interpretations = enumerateStandardInterpretations(hand);

  if (thirteenOrphans) {
    const candidate = createCandidate({
      dora,
      fu: null,
      hand,
      yaku: [],
      yakuman: evaluateYakuman(hand, null, true),
    });

    if (candidate !== null) {
      candidates.push(candidate);
    }
  }

  if (sevenPairs) {
    const yakuman = evaluateYakuman(hand, null, false);
    const candidate = createCandidate({
      dora,
      fu: sevenPairsFu(),
      hand,
      yaku: evaluateSevenPairsYaku(hand),
      yakuman,
    });

    if (candidate !== null) {
      candidates.push(candidate);
    }
  }

  for (const interpretation of interpretations) {
    const yakuman = evaluateYakuman(hand, interpretation, false);
    const yaku = evaluateStandardYaku(hand, interpretation);
    const candidate = createCandidate({
      dora,
      fu: calculateStandardFu(hand, interpretation, yaku),
      hand,
      yaku,
      yakuman,
    });

    if (candidate !== null) {
      candidates.push(candidate);
    }
  }

  if (hand.context.firstTurn === "renhou" && (sevenPairs || interpretations.length > 0)) {
    const candidate = createCandidate({
      dora: { dora: 0, redDora: 0, total: 0, uraDora: 0 },
      fu: sevenPairs ? sevenPairsFu() : null,
      hand,
      yaku: renhouYaku(),
      yakuman: [],
    });

    if (candidate !== null) {
      candidates.push(candidate);
    }
  }

  if (!sevenPairs && !thirteenOrphans && interpretations.length === 0) {
    return { kind: "not-winning", message: "The tiles do not form a complete winning hand." };
  }

  const best = candidates.toSorted(compareCandidates)[0];

  if (best === undefined) {
    return { kind: "no-yaku", message: "The hand is complete but has no yaku." };
  }

  return best;
}
