import {
  defaultHouseRules,
  houseScoringRules,
  parseHouseRules,
  serializeHouseRules,
} from "./house-rules";

describe("house rules", () => {
  it("round-trips what a table configured", () => {
    const rules = {
      ...defaultHouseRules,
      countedLimit: "sanbaiman",
      doubleWindPairFu: 4,
      kiriageMangan: true,
      label: "Thursday club",
      uraDora: false,
    } as const;

    expect(parseHouseRules(serializeHouseRules(rules))).toEqual(rules);
  });

  it("falls back to defaults for absent, malformed, or partial storage", () => {
    expect(parseHouseRules(null)).toEqual(defaultHouseRules);
    expect(parseHouseRules("not json")).toEqual(defaultHouseRules);
    expect(parseHouseRules('"a string"')).toEqual(defaultHouseRules);
    expect(parseHouseRules(JSON.stringify({ redFives: false }))).toEqual({
      ...defaultHouseRules,
      redFives: false,
    });
  });

  it("rejects values outside each option instead of trusting them", () => {
    const parsed = parseHouseRules(
      JSON.stringify({
        countedLimit: "unlimited",
        doubleWindPairFu: 9,
        label: "   ",
        redFives: "yes",
        yakumanStacking: "triple",
      }),
    );

    expect(parsed).toEqual(defaultHouseRules);
  });

  it("scores through the same pipeline while citing no published source", () => {
    const scoring = houseScoringRules({ ...defaultHouseRules, label: "Thursday club" });

    expect(scoring).toMatchObject({
      doubleYakuman: false,
      id: "house",
      label: "Thursday club",
      sourceUrl: null,
    });
  });

  it("names an unnamed profile rather than showing an empty label", () => {
    expect(houseScoringRules({ ...defaultHouseRules, label: "  " }).label).toBe("House rules");
  });
});
