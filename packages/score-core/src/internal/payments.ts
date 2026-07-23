import type { LimitName, PaymentBreakdown } from "../domain/score";
import type { ScoringRules } from "../domain/rules";
import type { WinContext } from "../domain/hand";

export interface BasePointResult {
  readonly basePoints: number;
  readonly limit: LimitName | null;
}

function yakumanLimitName(count: number): LimitName {
  if (count === 1) {
    return "yakuman";
  }

  if (count === 2) {
    return "double yakuman";
  }

  if (count === 3) {
    return "triple yakuman";
  }

  if (count === 4) {
    return "quadruple yakuman";
  }

  return `${count}x yakuman`;
}

export function calculateBasePoints(
  han: number,
  fu: number,
  yakumanCount: number,
  rules: ScoringRules,
): BasePointResult {
  if (yakumanCount > 0) {
    // Some rulesets never stack yakuman, and some stack them only up to a cap.
    const stacked = rules.yakumanStacking === "single" ? 1 : yakumanCount;
    const payable =
      rules.maxYakumanMultiple === null ? stacked : Math.min(stacked, rules.maxYakumanMultiple);
    return { basePoints: 8000 * payable, limit: yakumanLimitName(payable) };
  }

  if (han >= 13 && rules.countedLimit === "yonbaiman") {
    return { basePoints: 8000, limit: "yonbaiman" };
  }

  if (han >= 11) {
    return { basePoints: 6000, limit: "sanbaiman" };
  }

  if (han >= 8) {
    return { basePoints: 4000, limit: "baiman" };
  }

  if (han >= 6) {
    return { basePoints: 3000, limit: "haneman" };
  }

  if (han === 5) {
    return { basePoints: 2000, limit: "mangan" };
  }

  const rawBasePoints = fu * 2 ** (han + 2);

  if (rawBasePoints >= 2000 || (rules.kiriageMangan && rawBasePoints === 1920)) {
    return { basePoints: 2000, limit: "mangan" };
  }

  return { basePoints: rawBasePoints, limit: null };
}

function roundToHundred(points: number): number {
  return Math.ceil(points / 100) * 100;
}

export function calculatePayments(basePoints: number, context: WinContext): PaymentBreakdown {
  const dealerWinner = context.seatWind === "east";

  if (context.method === "ron") {
    const fromDiscarder = roundToHundred(basePoints * (dealerWinner ? 6 : 4)) + context.honba * 300;
    return { fromDiscarder, kind: "ron", total: fromDiscarder };
  }

  if (dealerWinner) {
    const fromEachNonDealer = roundToHundred(basePoints * 2) + context.honba * 100;
    return {
      fromDealer: null,
      fromEachNonDealer,
      kind: "tsumo",
      total: fromEachNonDealer * 3,
    };
  }

  const fromDealer = roundToHundred(basePoints * 2) + context.honba * 100;
  const fromEachNonDealer = roundToHundred(basePoints) + context.honba * 100;
  return {
    fromDealer,
    fromEachNonDealer,
    kind: "tsumo",
    total: fromDealer + fromEachNonDealer * 2,
  };
}
