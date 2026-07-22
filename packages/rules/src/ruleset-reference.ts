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
