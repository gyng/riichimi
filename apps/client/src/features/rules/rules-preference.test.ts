import { parseRulesPreference } from "./rules-preference";

describe("rules preference", () => {
  it("accepts supported profiles and falls back safely for stale storage", () => {
    expect(parseRulesPreference("wrc-2025-red-five-table")).toBe("wrc-2025-red-five-table");
    expect(parseRulesPreference("removed-profile")).toBe("wrc-2025");
    expect(parseRulesPreference(null)).toBe("wrc-2025");
  });
});
