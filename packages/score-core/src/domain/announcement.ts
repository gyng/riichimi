import type { DoraBreakdown, LimitName, PaymentBreakdown, ScoreSuccess } from "./score";
import { yakuReference, yakumanReference } from "./yaku-catalog";

/** A yaku as a voice needs it: the reading, and the same reading romanized. */
export interface AnnouncedTerm {
  /** Japanese reading, e.g. メンゼンツモ. */
  readonly kana: string;
  /** The same term for an engine with no Japanese voice, e.g. "Menzen tsumo". */
  readonly romaji: string;
}

/**
 * A scored win reduced to the facts worth announcing, as structured data rather
 * than a finished sentence. Wording belongs to the interface layer, so a
 * translation can replace it without touching scoring.
 */
export interface WinAnnouncement {
  /** Counts only. How they are said — ドラ2 — is the interface's business. */
  readonly dora: DoraBreakdown;
  readonly fu: number | null;
  readonly han: number | null;
  /** Every yakuman when the hand is a yakuman, otherwise every yaku, ordered
      cheapest first so the reading builds towards the biggest one. */
  readonly headline: readonly AnnouncedTerm[];
  readonly limit: LimitName | null;
  readonly method: PaymentBreakdown["kind"];
  readonly points: number;
}

export function announceWin(result: ScoreSuccess): WinAnnouncement {
  // Cheapest first: an announcer builds to the big one rather than opening on
  // it, and the limit lands last of all.
  const headline =
    result.yakuman.length > 0
      ? result.yakuman.map(({ id, romanized }) => ({
          kana: yakumanReference(id).kana,
          romaji: romanized,
        }))
      : result.yaku
          .toSorted((left, right) => left.han - right.han)
          .map(({ id, romanized }) => ({ kana: yakuReference(id).kana, romaji: romanized }));

  return {
    dora: result.dora,
    fu: result.fu?.rounded ?? null,
    han: result.han,
    headline,
    limit: result.limit,
    method: result.payments.kind,
    points: result.totalGain,
  };
}
