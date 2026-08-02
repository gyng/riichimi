import type { ScoreHandResult } from "@riichimi/score-core";

/**
 * The one-line reading of a score.
 *
 * Shared so the dock and the audit panel cannot disagree about what a hand is
 * worth: they render the same two strings from the same result rather than
 * computing them twice.
 */

export interface ScoreHeadline {
  /** "2 han · 20 fu", or the limit's name once a hand reaches one. */
  readonly title: string;
  /** Who pays what, in the shape the win method makes true. */
  readonly payment: string;
}

const points = (value: number): string => new Intl.NumberFormat("en-US").format(value);

export function scoreHeadline(
  result: ScoreHandResult,
  t: (source: string) => string,
): ScoreHeadline | null {
  if (result.kind !== "success") {
    return null;
  }
  return {
    payment:
      result.payments.kind === "ron"
        ? `${points(result.payments.fromDiscarder)} ${t("from discarder")}`
        : result.payments.fromDealer === null
          ? `${points(result.payments.fromEachNonDealer)} ${t("all")}`
          : `${points(result.payments.fromDealer)} / ${points(result.payments.fromEachNonDealer)}`,
    title:
      result.limit === null
        ? `${result.han ?? 0} ${t("han")} · ${result.fu?.rounded ?? 0} ${t("fu")}`
        : result.limit.toUpperCase(),
  };
}

/** The short reason a hand did not score, for the dock. */
export function scoreProblem(
  result: ScoreHandResult,
  t: (source: string) => string,
): string | null {
  switch (result.kind) {
    case "success": {
      return null;
    }
    case "invalid": {
      return t("Check the hand");
    }
    case "not-winning": {
      return t("Not a complete hand");
    }
    case "no-yaku": {
      return t("A yaku is still needed");
    }
    default: {
      return null;
    }
  }
}
