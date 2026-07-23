import { describe, expect, it } from "vitest";

import type { PaymentBreakdown, ScoringRules, WinContext, Wind, WinMethod } from "../index";
import { calculateBasePoints, calculatePayments } from "./payments";

function ronPayment(payment: PaymentBreakdown): { readonly fromDiscarder: number } {
  if (payment.kind !== "ron") {
    throw new Error(`Expected a ron payment, received ${payment.kind}.`);
  }
  return payment;
}

function tsumoPayment(payment: PaymentBreakdown): {
  readonly fromDealer: number | null;
  readonly fromEachNonDealer: number;
} {
  if (payment.kind !== "tsumo") {
    throw new Error(`Expected a tsumo payment, received ${payment.kind}.`);
  }
  return payment;
}

// Cross-checks the payment engine against an INDEPENDENT reference grounded in
// the published riichi scoring table. Two layers:
//   1. PUBLISHED — landmark cells transcribed from the canonical scoring table
//      (external authority). Asserts BOTH the engine and the reference reproduce
//      them, so neither is circular.
//   2. Exhaustive differential — the reference sweeps the whole (han, fu, seat,
//      method, rules) grid; the engine must agree on every cell. Any divergence
//      is a real discrepancy and its case becomes a regression.
//
// The reference is written from the rules spec, not from payments.ts:
//   base = fu * 2^(han+2), capped to limit tiers; ron pays 6x (dealer) / 4x
//   (non-dealer); tsumo the dealer pays 2x and each non-dealer 1x, each payer's
//   share rounded UP to the next 100, plus 100 honba per payer (300 per ron).

const baseRules = {
  allowOpenTanyao: true,
  countedLimit: "yonbaiman",
  doubleYakuman: false,
  doubleWindPairFu: 2,
  maxYakumanMultiple: null,
  uraDora: true,
  yakumanStacking: "additive",
  id: "cross-check",
  kiriageMangan: false,
  label: "Cross-check",
  redFives: false,
  revision: "test",
  sourceUrl: "https://www.worldriichi.org/wrc-rules",
} as const satisfies ScoringRules;

function ceilHundred(points: number): number {
  return Math.ceil(points / 100) * 100;
}

interface ReferencePayment {
  readonly ron: { readonly dealer: number; readonly nonDealer: number };
  readonly tsumo: {
    readonly dealerEach: number; // each non-dealer pays a dealer winner
    readonly nonDealerFromDealer: number; // the dealer pays a non-dealer winner
    readonly nonDealerFromOther: number; // each non-dealer pays a non-dealer winner
  };
}

/** Independent base-point reference (spec-derived, not read from payments.ts). */
function referenceBasePoints(
  han: number,
  fu: number,
  yakuman: number,
  rules: ScoringRules,
): number {
  if (yakuman > 0) {
    return 8000 * yakuman;
  }
  if (han >= 13) {
    return 8000; // ScoringRules.countedLimit is always "yonbaiman" (kazoe yakuman)
  }
  if (han >= 11) {
    return 6000;
  }
  if (han >= 8) {
    return 4000;
  }
  if (han >= 6) {
    return 3000;
  }
  if (han === 5) {
    return 2000;
  }
  const raw = fu * 2 ** (han + 2);
  if (raw >= 2000) {
    return 2000; // any hand reaching mangan base is capped at mangan
  }
  if (rules.kiriageMangan && raw === 1920) {
    return 2000; // 4han30fu / 3han60fu rounded up under kiriage
  }
  return raw;
}

/** Independent per-payer payments from a base value, honba 0. */
function referencePayment(base: number): ReferencePayment {
  return {
    ron: { dealer: ceilHundred(base * 6), nonDealer: ceilHundred(base * 4) },
    tsumo: {
      dealerEach: ceilHundred(base * 2),
      nonDealerFromDealer: ceilHundred(base * 2),
      nonDealerFromOther: ceilHundred(base),
    },
  };
}

// --- Layer 1: landmark cells transcribed from the published scoring table. ---
// { han, fu, nonDealerRon, [tsumoOther, tsumoDealer], dealerRon, dealerTsumoEach }
interface PublishedCell {
  readonly han: number;
  readonly fu: number;
  readonly ndRon: number;
  readonly ndTsumoOther: number;
  readonly ndTsumoDealer: number;
  readonly dRon: number;
  readonly dTsumoEach: number;
}

const PUBLISHED: readonly PublishedCell[] = [
  {
    han: 1,
    fu: 30,
    ndRon: 1000,
    ndTsumoOther: 300,
    ndTsumoDealer: 500,
    dRon: 1500,
    dTsumoEach: 500,
  },
  {
    han: 1,
    fu: 40,
    ndRon: 1300,
    ndTsumoOther: 400,
    ndTsumoDealer: 700,
    dRon: 2000,
    dTsumoEach: 700,
  },
  {
    han: 1,
    fu: 50,
    ndRon: 1600,
    ndTsumoOther: 400,
    ndTsumoDealer: 800,
    dRon: 2400,
    dTsumoEach: 800,
  },
  {
    han: 2,
    fu: 25,
    ndRon: 1600,
    ndTsumoOther: 400,
    ndTsumoDealer: 800,
    dRon: 2400,
    dTsumoEach: 800,
  },
  {
    han: 2,
    fu: 30,
    ndRon: 2000,
    ndTsumoOther: 500,
    ndTsumoDealer: 1000,
    dRon: 2900,
    dTsumoEach: 1000,
  },
  {
    han: 2,
    fu: 40,
    ndRon: 2600,
    ndTsumoOther: 700,
    ndTsumoDealer: 1300,
    dRon: 3900,
    dTsumoEach: 1300,
  },
  {
    han: 2,
    fu: 50,
    ndRon: 3200,
    ndTsumoOther: 800,
    ndTsumoDealer: 1600,
    dRon: 4800,
    dTsumoEach: 1600,
  },
  {
    han: 3,
    fu: 25,
    ndRon: 3200,
    ndTsumoOther: 800,
    ndTsumoDealer: 1600,
    dRon: 4800,
    dTsumoEach: 1600,
  },
  {
    han: 3,
    fu: 30,
    ndRon: 3900,
    ndTsumoOther: 1000,
    ndTsumoDealer: 2000,
    dRon: 5800,
    dTsumoEach: 2000,
  },
  {
    han: 3,
    fu: 40,
    ndRon: 5200,
    ndTsumoOther: 1300,
    ndTsumoDealer: 2600,
    dRon: 7700,
    dTsumoEach: 2600,
  },
  {
    han: 3,
    fu: 50,
    ndRon: 6400,
    ndTsumoOther: 1600,
    ndTsumoDealer: 3200,
    dRon: 9600,
    dTsumoEach: 3200,
  },
  {
    han: 3,
    fu: 60,
    ndRon: 7700,
    ndTsumoOther: 2000,
    ndTsumoDealer: 3900,
    dRon: 11600,
    dTsumoEach: 3900,
  },
  {
    han: 4,
    fu: 25,
    ndRon: 6400,
    ndTsumoOther: 1600,
    ndTsumoDealer: 3200,
    dRon: 9600,
    dTsumoEach: 3200,
  },
  {
    han: 4,
    fu: 30,
    ndRon: 7700,
    ndTsumoOther: 2000,
    ndTsumoDealer: 3900,
    dRon: 11600,
    dTsumoEach: 3900,
  },
  // Limit tiers (han-driven, fu irrelevant).
  {
    han: 5,
    fu: 30,
    ndRon: 8000,
    ndTsumoOther: 2000,
    ndTsumoDealer: 4000,
    dRon: 12000,
    dTsumoEach: 4000,
  },
  {
    han: 6,
    fu: 30,
    ndRon: 12000,
    ndTsumoOther: 3000,
    ndTsumoDealer: 6000,
    dRon: 18000,
    dTsumoEach: 6000,
  },
  {
    han: 8,
    fu: 30,
    ndRon: 16000,
    ndTsumoOther: 4000,
    ndTsumoDealer: 8000,
    dRon: 24000,
    dTsumoEach: 8000,
  },
  {
    han: 11,
    fu: 30,
    ndRon: 24000,
    ndTsumoOther: 6000,
    ndTsumoDealer: 12000,
    dRon: 36000,
    dTsumoEach: 12000,
  },
  {
    han: 13,
    fu: 30,
    ndRon: 32000,
    ndTsumoOther: 8000,
    ndTsumoDealer: 16000,
    dRon: 48000,
    dTsumoEach: 16000,
  },
];

const noHonba = {
  chankan: false,
  firstTurn: "none",
  honba: 0,
  ippatsu: false,
  lastTile: "none",
  method: "ron",
  riichi: "none",
  riichiSticks: 0,
  rinshan: false,
  roundWind: "east",
  seatWind: "south",
} as const satisfies WinContext;

function context(seatWind: Wind, method: WinMethod, honba = 0): WinContext {
  return { ...noHonba, honba, method, seatWind };
}

function engineBase(han: number, fu: number, rules: ScoringRules = baseRules): number {
  return calculateBasePoints(han, fu, 0, rules).basePoints;
}

describe("published scoring table (external authority)", () => {
  it.each(PUBLISHED)("non-dealer $han han $fu fu matches the published cell", (cell) => {
    const base = engineBase(cell.han, cell.fu);
    expect(calculatePayments(base, context("south", "ron"))).toEqual({
      fromDiscarder: cell.ndRon,
      kind: "ron",
      total: cell.ndRon,
    });
    expect(calculatePayments(base, context("south", "tsumo"))).toEqual({
      fromDealer: cell.ndTsumoDealer,
      fromEachNonDealer: cell.ndTsumoOther,
      kind: "tsumo",
      total: cell.ndTsumoDealer + cell.ndTsumoOther * 2,
    });
  });

  it.each(PUBLISHED)("dealer $han han $fu fu matches the published cell", (cell) => {
    const base = engineBase(cell.han, cell.fu);
    expect(calculatePayments(base, context("east", "ron"))).toEqual({
      fromDiscarder: cell.dRon,
      kind: "ron",
      total: cell.dRon,
    });
    expect(calculatePayments(base, context("east", "tsumo"))).toEqual({
      fromDealer: null,
      fromEachNonDealer: cell.dTsumoEach,
      kind: "tsumo",
      total: cell.dTsumoEach * 3,
    });
  });

  it("the reference itself reproduces every published cell", () => {
    for (const cell of PUBLISHED) {
      const pay = referencePayment(referenceBasePoints(cell.han, cell.fu, 0, baseRules));
      expect(pay.ron.nonDealer).toBe(cell.ndRon);
      expect(pay.ron.dealer).toBe(cell.dRon);
      expect(pay.tsumo.nonDealerFromOther).toBe(cell.ndTsumoOther);
      expect(pay.tsumo.nonDealerFromDealer).toBe(cell.ndTsumoDealer);
      expect(pay.tsumo.dealerEach).toBe(cell.dTsumoEach);
    }
  });
});

const FU_VALUES = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110] as const;
const HAN_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 20] as const;
// countedLimit is always "yonbaiman" in this codebase, so kiriage on/off are the
// only payment-affecting rule variants to sweep.
const RULE_VARIANTS: readonly ScoringRules[] = [
  { ...baseRules, kiriageMangan: false },
  { ...baseRules, kiriageMangan: true },
];

describe("exhaustive engine-vs-reference differential", () => {
  it("agrees on every (han, fu, seat, method, rules) cell", () => {
    const mismatches: string[] = [];
    for (const rules of RULE_VARIANTS) {
      for (const han of HAN_VALUES) {
        for (const fu of FU_VALUES) {
          const engine = calculateBasePoints(han, fu, 0, rules).basePoints;
          const reference = referenceBasePoints(han, fu, 0, rules);
          if (engine !== reference) {
            mismatches.push(
              `base han=${han} fu=${fu} kiriage=${rules.kiriageMangan}: ${engine} != ${reference}`,
            );
            continue;
          }
          const ref = referencePayment(reference);
          for (const seat of ["east", "south"] as const) {
            const ron = ronPayment(calculatePayments(engine, context(seat, "ron")));
            const expectedRon = seat === "east" ? ref.ron.dealer : ref.ron.nonDealer;
            if (ron.fromDiscarder !== expectedRon) {
              mismatches.push(
                `ron han=${han} fu=${fu} seat=${seat}: ${ron.fromDiscarder} != ${expectedRon}`,
              );
            }
            const tsumo = tsumoPayment(calculatePayments(engine, context(seat, "tsumo")));
            if (seat === "east") {
              if (tsumo.fromEachNonDealer !== ref.tsumo.dealerEach || tsumo.fromDealer !== null) {
                mismatches.push(`dealer tsumo han=${han} fu=${fu}: ${JSON.stringify(tsumo)}`);
              }
            } else if (
              tsumo.fromDealer !== ref.tsumo.nonDealerFromDealer ||
              tsumo.fromEachNonDealer !== ref.tsumo.nonDealerFromOther
            ) {
              mismatches.push(`non-dealer tsumo han=${han} fu=${fu}: ${JSON.stringify(tsumo)}`);
            }
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("agrees on yakuman multiples", () => {
    for (let count = 1; count <= 4; count += 1) {
      for (const seat of ["east", "south"] as const) {
        const base = calculateBasePoints(0, 0, count, baseRules).basePoints;
        expect(base).toBe(referenceBasePoints(0, 0, count, baseRules));
        const ref = referencePayment(base);
        expect(ronPayment(calculatePayments(base, context(seat, "ron"))).fromDiscarder).toBe(
          seat === "east" ? ref.ron.dealer : ref.ron.nonDealer,
        );
      }
    }
  });
});

describe("honba is added per payer", () => {
  it("adds 300 total to ron and 100 per payer to tsumo", () => {
    const base = 2000; // mangan
    // 2 honba non-dealer tsumo: +100 to each of the three payers.
    expect(calculatePayments(base, context("south", "tsumo", 2))).toEqual({
      fromDealer: ceilHundred(base * 2) + 200,
      fromEachNonDealer: ceilHundred(base) + 200,
      kind: "tsumo",
      total: ceilHundred(base * 2) + 200 + (ceilHundred(base) + 200) * 2,
    });
    // 2 honba non-dealer ron: +600 total.
    expect(calculatePayments(base, context("south", "ron", 2))).toEqual({
      fromDiscarder: ceilHundred(base * 4) + 600,
      kind: "ron",
      total: ceilHundred(base * 4) + 600,
    });
  });
});
