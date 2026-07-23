import { describe, expect, it } from "vitest";

import {
  emaRules,
  isScoringRulesProfileId,
  jpmlARules,
  mLeagueRules,
  tenhouRules,
  scoringRulesProfile,
  scoringRulesProfiles,
  wrc2025RedFiveTableRules,
  wrc2025Rules,
} from "./ruleset-reference";

describe("scoring rules profiles", () => {
  it("keeps profile identity unique and resolves unknown persisted ids safely", () => {
    expect(new Set(scoringRulesProfiles.map(({ id }) => id)).size).toBe(
      scoringRulesProfiles.length,
    );
    expect(isScoringRulesProfileId(wrc2025RedFiveTableRules.id)).toBe(true);
    expect(isScoringRulesProfileId("unknown")).toBe(false);
    expect(scoringRulesProfile("unknown")).toBe(wrc2025Rules);
  });

  it("documents the local table variant as exactly one WRC policy change", () => {
    expect(wrc2025RedFiveTableRules).toEqual({
      ...wrc2025Rules,
      id: "wrc-2025-red-five-table",
      label: "WRC 2025 · red-five table",
      redFives: true,
      revision: "2025+local-red-fives",
    });
  });
});

describe("published ruleset profiles", () => {
  it("cites a source for every profile", () => {
    for (const profile of scoringRulesProfiles) {
      expect(profile.sourceUrl.startsWith("https://")).toBe(true);
    }
  });

  // Each assertion below is the rule that actually distinguishes the ruleset, so
  // a careless edit to a profile fails here rather than silently misscoring.
  it("keeps Tenhou on kazoe yakuman without round-up mangan", () => {
    expect(tenhouRules).toMatchObject({
      countedLimit: "yonbaiman",
      doubleWindPairFu: 4,
      kiriageMangan: false,
      redFives: true,
      uraDora: true,
      yakumanStacking: "additive",
    });
  });

  it("keeps EMA free of red fives, kazoe yakuman, and yakuman stacking", () => {
    expect(emaRules).toMatchObject({
      countedLimit: "sanbaiman",
      kiriageMangan: false,
      redFives: false,
      yakumanStacking: "single",
    });
  });

  it("keeps M.League as the one profile with round-up mangan, capped at sanbaiman", () => {
    expect(mLeagueRules).toMatchObject({
      countedLimit: "sanbaiman",
      doubleWindPairFu: 2,
      kiriageMangan: true,
      redFives: true,
    });
    const withKiriage = scoringRulesProfiles.filter(({ kiriageMangan }) => kiriageMangan);
    expect(withKiriage.map(({ id }) => id)).toEqual([
      "wrc-2025",
      "wrc-2025-red-five-table",
      "m-league",
    ]);
  });

  it("keeps JPML without ura-dora or red fives, capped at four yakuman", () => {
    expect(jpmlARules).toMatchObject({
      countedLimit: "yonbaiman",
      maxYakumanMultiple: 4,
      redFives: false,
      uraDora: false,
    });
    // JPML is the only shipped profile that plays without ura-dora.
    expect(scoringRulesProfiles.filter(({ uraDora }) => !uraDora).map(({ id }) => id)).toEqual([
      "jpml-a",
    ]);
  });
});
