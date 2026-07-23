import type { ScoringRules } from "@riichimi/score-core";

export const wrc2025Rules = {
  allowOpenTanyao: true,
  countedLimit: "yonbaiman",
  doubleYakuman: false,
  doubleWindPairFu: 2,
  maxYakumanMultiple: null,
  uraDora: true,
  yakumanStacking: "additive",
  id: "wrc-2025",
  kiriageMangan: true,
  label: "World Riichi Rules 2025",
  redFives: false,
  revision: "2025",
  sourceUrl: "https://www.worldriichi.org/wrc-rules",
} as const satisfies ScoringRules;

export const wrc2025RedFiveTableRules = {
  ...wrc2025Rules,
  id: "wrc-2025-red-five-table",
  label: "WRC 2025 · red-five table",
  redFives: true,
  revision: "2025+local-red-fives",
} as const satisfies ScoringRules;

/**
 * Tenhou 段位戦 (ranked), the 喰赤 configuration the Houou lobby plays.
 * Source: https://tenhou.net/man/ — "※数え役満は13翻以上", red fives 各1枚,
 * and 切り上げ満貫 listed only under 雀荘戦, not 段位戦.
 */
export const tenhouRules = {
  allowOpenTanyao: true,
  countedLimit: "yonbaiman",
  doubleWindPairFu: 4,
  doubleYakuman: false,
  id: "tenhou-hanchan",
  kiriageMangan: false,
  label: "Tenhou · ranked",
  // Composite yakuman stack; Tenhou pays no single-yaku double yakuman.
  maxYakumanMultiple: null,
  redFives: true,
  revision: "danisen-kuiaka",
  sourceUrl: "https://tenhou.net/man/",
  uraDora: true,
  yakumanStacking: "additive",
} as const satisfies ScoringRules;

/**
 * EMA Riichi Competition Rules (2016). Distinctive: no red fives, no kazoe
 * yakuman ("A hand with 13+ fan is scored as a sanbaiman"), and yakuman that do
 * not combine ("Yakuman are not cumulative").
 * Source: https://mahjong-europe.org/portal/images/docs/Riichi-rules-2016-EN.pdf
 *
 * The double-wind pair is an interpretation: the rulebook lists seat-wind and
 * round-wind pairs as separate 2-fu entries and never states a combined value,
 * so a pair that is both is read literally as 2 + 2.
 */
export const emaRules = {
  allowOpenTanyao: true,
  countedLimit: "sanbaiman",
  doubleWindPairFu: 4,
  doubleYakuman: false,
  id: "ema-2016",
  kiriageMangan: false,
  label: "EMA Riichi 2016",
  maxYakumanMultiple: null,
  redFives: false,
  revision: "2016",
  sourceUrl: "https://mahjong-europe.org/portal/images/docs/Riichi-rules-2016-EN.pdf",
  uraDora: true,
  yakumanStacking: "single",
} as const satisfies ScoringRules;

/**
 * M.League. The only profile here with kiriage mangan ("20符以上の7翻、30符以上の
 * 6翻と7翻、60符以上の5翻"), and it caps a counted hand at sanbaiman
 * ("役満以外の役が複合したアガリ点は、三倍満までを上限とする").
 * Source: https://m-league.jp/about/
 */
export const mLeagueRules = {
  allowOpenTanyao: true,
  countedLimit: "sanbaiman",
  doubleWindPairFu: 2,
  doubleYakuman: false,
  id: "m-league",
  kiriageMangan: true,
  label: "M.League",
  maxYakumanMultiple: null,
  redFives: true,
  revision: "official",
  sourceUrl: "https://m-league.jp/about/",
  uraDora: true,
  yakumanStacking: "additive",
} as const satisfies ScoringRules;

/**
 * JPML A-rule (日本プロ麻雀連盟 競技ルール). Plays without red fives and without
 * ura-dora ("連盟公式ルールは表ドラのみあり"), counts 13+ han as yonbaiman, and
 * caps combined yakuman at four ("最高4倍役満").
 * Source: https://www.ma-jan.or.jp/activity/game_rule.html
 */
export const jpmlARules = {
  allowOpenTanyao: true,
  countedLimit: "yonbaiman",
  doubleWindPairFu: 2,
  doubleYakuman: false,
  id: "jpml-a",
  kiriageMangan: false,
  label: "JPML A-rule",
  maxYakumanMultiple: 4,
  redFives: false,
  revision: "a-rule",
  sourceUrl: "https://www.ma-jan.or.jp/activity/game_rule.html",
  uraDora: false,
  yakumanStacking: "additive",
} as const satisfies ScoringRules;

export const scoringRulesProfiles = [
  wrc2025Rules,
  wrc2025RedFiveTableRules,
  tenhouRules,
  emaRules,
  mLeagueRules,
  jpmlARules,
] as const;

export type ScoringRulesProfileId = (typeof scoringRulesProfiles)[number]["id"];

export function isScoringRulesProfileId(value: string): value is ScoringRulesProfileId {
  return scoringRulesProfiles.some(({ id }) => id === value);
}

export function scoringRulesProfile(profileId: string): ScoringRules {
  return scoringRulesProfiles.find(({ id }) => id === profileId) ?? wrc2025Rules;
}
