import { describe, expect, it } from "vitest";

import type { ScoringRules } from "../index";
import { calculateBasePoints } from "./payments";

const baseRules = {
  allowOpenTanyao: true,
  countedLimit: "yonbaiman",
  doubleWindPairFu: 2,
  doubleYakuman: false,
  id: "variant-test",
  kiriageMangan: false,
  label: "Variant test",
  maxYakumanMultiple: null,
  redFives: false,
  revision: "test",
  sourceUrl: "https://example.test/rules",
  uraDora: true,
  yakumanStacking: "additive",
} as const satisfies ScoringRules;

function rulesWith(overrides: Partial<ScoringRules>): ScoringRules {
  return { ...baseRules, ...overrides };
}

describe("counted limit at 13+ han", () => {
  it("pays a counted yakuman when the ruleset allows one", () => {
    expect(calculateBasePoints(13, 30, 0, rulesWith({ countedLimit: "yonbaiman" }))).toEqual({
      basePoints: 8000,
      limit: "yonbaiman",
    });
  });

  it("caps at sanbaiman for a ruleset without kazoe yakuman", () => {
    expect(calculateBasePoints(13, 30, 0, rulesWith({ countedLimit: "sanbaiman" }))).toEqual({
      basePoints: 6000,
      limit: "sanbaiman",
    });
  });

  it("leaves the sanbaiman band itself unchanged either way", () => {
    for (const countedLimit of ["yonbaiman", "sanbaiman"] as const) {
      expect(calculateBasePoints(11, 30, 0, rulesWith({ countedLimit }))).toEqual({
        basePoints: 6000,
        limit: "sanbaiman",
      });
    }
  });
});

describe("combining yakuman", () => {
  it("stacks combined yakuman additively by default", () => {
    expect(calculateBasePoints(0, 0, 2, rulesWith({ yakumanStacking: "additive" }))).toEqual({
      basePoints: 16000,
      limit: "double yakuman",
    });
  });

  it("pays a single yakuman for a ruleset where they never stack", () => {
    expect(calculateBasePoints(0, 0, 3, rulesWith({ yakumanStacking: "single" }))).toEqual({
      basePoints: 8000,
      limit: "yakuman",
    });
  });

  it("stops stacking at a ruleset's maximum multiple", () => {
    expect(calculateBasePoints(0, 0, 6, rulesWith({ maxYakumanMultiple: 4 }))).toEqual({
      basePoints: 32000,
      limit: "quadruple yakuman",
    });
  });

  it("leaves a hand below the cap untouched", () => {
    expect(calculateBasePoints(0, 0, 2, rulesWith({ maxYakumanMultiple: 4 }))).toEqual({
      basePoints: 16000,
      limit: "double yakuman",
    });
  });
});
