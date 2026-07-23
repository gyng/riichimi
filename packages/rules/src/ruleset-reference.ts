import type { ScoringRules } from "@richii/score-core";

export const wrc2025Rules = {
  allowOpenTanyao: true,
  countedLimit: "yonbaiman",
  doubleYakuman: false,
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

export const scoringRulesProfiles = [wrc2025Rules, wrc2025RedFiveTableRules] as const;

export type ScoringRulesProfileId = (typeof scoringRulesProfiles)[number]["id"];

export function isScoringRulesProfileId(value: string): value is ScoringRulesProfileId {
  return scoringRulesProfiles.some(({ id }) => id === value);
}

export function scoringRulesProfile(profileId: string): ScoringRules {
  return scoringRulesProfiles.find(({ id }) => id === profileId) ?? wrc2025Rules;
}
