import type { HandValidationIssue } from "./hand";

export interface Yaku {
  readonly han: number;
  readonly id: string;
  readonly name: string;
  readonly romanized: string;
}

export interface Yakuman {
  readonly id: string;
  readonly name: string;
  readonly romanized: string;
  /** 1 for a normal yakuman; 2 for a single yaku that pays double (e.g. the
      13-wait kokushi or suuankou tanki) under a ruleset that recognizes it. */
  readonly value: 1 | 2;
}

export interface DoraBreakdown {
  readonly dora: number;
  readonly redDora: number;
  readonly total: number;
  readonly uraDora: number;
}

export interface FuItem {
  readonly fu: number;
  readonly reason: string;
}

export interface FuBreakdown {
  readonly items: readonly FuItem[];
  readonly rounded: number;
  readonly unrounded: number;
}

export type LimitName =
  | "mangan"
  | "haneman"
  | "baiman"
  | "sanbaiman"
  | "yonbaiman"
  | "yakuman"
  | "double yakuman"
  | "triple yakuman"
  | "quadruple yakuman"
  | `${number}x yakuman`;

export type PaymentBreakdown =
  | {
      readonly fromDiscarder: number;
      readonly kind: "ron";
      readonly total: number;
    }
  | {
      readonly fromDealer: number | null;
      readonly fromEachNonDealer: number;
      readonly kind: "tsumo";
      readonly total: number;
    };

export interface ScoreSuccess {
  readonly basePoints: number;
  readonly dora: DoraBreakdown;
  readonly fu: FuBreakdown | null;
  readonly han: number | null;
  readonly kind: "success";
  readonly limit: LimitName | null;
  readonly payments: PaymentBreakdown;
  readonly riichiBonus: number;
  readonly totalGain: number;
  readonly yaku: readonly Yaku[];
  readonly yakuman: readonly Yakuman[];
}

export type ScoreHandResult =
  | ScoreSuccess
  | {
      readonly issues: readonly HandValidationIssue[];
      readonly kind: "invalid";
    }
  | {
      readonly kind: "not-winning";
      readonly message: string;
    }
  | {
      readonly kind: "no-yaku";
      readonly message: string;
    };
