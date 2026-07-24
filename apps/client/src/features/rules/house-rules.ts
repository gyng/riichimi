import type { ScoringRules } from "@riichimi/score-core";

export const houseRulesProfileId = "house";

/** The options a table may set for itself. Everything else follows WRC. */
export interface HouseRules {
  readonly allowOpenTanyao: boolean;
  readonly countedLimit: "sanbaiman" | "yonbaiman";
  readonly doubleWindPairFu: 2 | 4;
  readonly doubleYakuman: boolean;
  readonly kiriageMangan: boolean;
  readonly label: string;
  readonly redFives: boolean;
  readonly uraDora: boolean;
  readonly yakumanStacking: "additive" | "single";
}

export const defaultHouseRules: HouseRules = {
  allowOpenTanyao: true,
  countedLimit: "yonbaiman",
  doubleWindPairFu: 2,
  doubleYakuman: false,
  kiriageMangan: false,
  label: "House rules",
  redFives: true,
  uraDora: true,
  yakumanStacking: "additive",
};

/** A house profile scores through the same pipeline; it just cites no source. */
export function houseScoringRules(rules: HouseRules): ScoringRules {
  return {
    allowOpenTanyao: rules.allowOpenTanyao,
    countedLimit: rules.countedLimit,
    doubleWindPairFu: rules.doubleWindPairFu,
    doubleYakuman: rules.doubleYakuman,
    id: houseRulesProfileId,
    kiriageMangan: rules.kiriageMangan,
    label: rules.label.trim().length > 0 ? rules.label.trim() : defaultHouseRules.label,
    maxYakumanMultiple: null,
    redFives: rules.redFives,
    revision: "house",
    sourceUrl: null,
    uraDora: rules.uraDora,
    yakumanStacking: rules.yakumanStacking,
  };
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Stored house rules are untrusted input: anything missing or malformed falls
 * back to the default rather than failing the whole profile.
 */
export function parseHouseRules(value: string | null): HouseRules {
  if (value === null) {
    return defaultHouseRules;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return defaultHouseRules;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return defaultHouseRules;
  }
  const record: Record<string, unknown> = { ...parsed };
  const label = record["label"];
  return {
    allowOpenTanyao: boolean(record["allowOpenTanyao"], defaultHouseRules.allowOpenTanyao),
    countedLimit: record["countedLimit"] === "sanbaiman" ? "sanbaiman" : "yonbaiman",
    doubleWindPairFu: record["doubleWindPairFu"] === 4 ? 4 : 2,
    doubleYakuman: boolean(record["doubleYakuman"], defaultHouseRules.doubleYakuman),
    kiriageMangan: boolean(record["kiriageMangan"], defaultHouseRules.kiriageMangan),
    label: typeof label === "string" && label.trim().length > 0 ? label : defaultHouseRules.label,
    redFives: boolean(record["redFives"], defaultHouseRules.redFives),
    uraDora: boolean(record["uraDora"], defaultHouseRules.uraDora),
    yakumanStacking: record["yakumanStacking"] === "single" ? "single" : "additive",
  };
}

export function serializeHouseRules(rules: HouseRules): string {
  return JSON.stringify(rules);
}
