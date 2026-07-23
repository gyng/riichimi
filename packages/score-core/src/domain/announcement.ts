import type { LimitName, PaymentBreakdown, ScoreSuccess } from "./score";

/**
 * A scored win reduced to the facts worth announcing, as structured data rather
 * than a finished sentence. Wording belongs to the interface layer, so a
 * translation can replace it without touching scoring.
 */
export interface WinAnnouncement {
  readonly fu: number | null;
  readonly han: number | null;
  /** Yakuman names when the hand is a yakuman, otherwise its highest-han yaku. */
  readonly headline: readonly string[];
  readonly limit: LimitName | null;
  readonly method: PaymentBreakdown["kind"];
  readonly points: number;
}

const headlineYakuCount = 2;

export function announceWin(result: ScoreSuccess): WinAnnouncement {
  const headline =
    result.yakuman.length > 0
      ? result.yakuman.map(({ romanized }) => romanized)
      : result.yaku
          .toSorted((left, right) => right.han - left.han)
          .slice(0, headlineYakuCount)
          .map(({ romanized }) => romanized);

  return {
    fu: result.fu?.rounded ?? null,
    han: result.han,
    headline,
    limit: result.limit,
    method: result.payments.kind,
    points: result.totalGain,
  };
}
