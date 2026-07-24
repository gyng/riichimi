export interface ScoringRules {
  readonly allowOpenTanyao: boolean;
  /**
   * A 13+ han hand with no yakuman: "yonbaiman" pays it as a counted yakuman,
   * "sanbaiman" caps it one limit below (EMA and M.League play this way).
   */
  readonly countedLimit: "sanbaiman" | "yonbaiman";
  /** Fu for a pair that is both the seat wind and the round wind. */
  readonly doubleWindPairFu: 2 | 4;
  /** Whether a single yaku can pay a double yakuman — the 13-wait kokushi,
      suuankou tanki, junsei chuuren, and daisuushii. Rulesets that do not
      recognize these (WRC, EMA) leave it false and pay them as one yakuman. */
  readonly doubleYakuman: boolean;
  readonly id: string;
  readonly kiriageMangan: boolean;
  readonly label: string;
  /** Highest multiple payable when yakuman combine; null for no cap. */
  readonly maxYakumanMultiple: number | null;
  readonly redFives: boolean;
  readonly revision: string;
  /** Published rules cite their source; a table's own house rules have none. */
  readonly sourceUrl: `https://${string}` | null;
  /** Whether ura-dora indicators count for a riichi hand. */
  readonly uraDora: boolean;
  /**
   * "additive": combined yakuman stack, so a hand worth two pays double.
   * "single": a hand pays one yakuman however many it contains (EMA).
   */
  readonly yakumanStacking: "additive" | "single";
}
