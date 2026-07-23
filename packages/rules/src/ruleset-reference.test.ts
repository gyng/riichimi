import { describe, expect, it } from "vitest";

import {
  isScoringRulesProfileId,
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
