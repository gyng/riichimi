import { parseRulesPreference } from "./rules-preference";

describe("rules preference", () => {
  it("accepts supported profiles and falls back safely for stale storage", () => {
    expect(parseRulesPreference("wrc-2025-red-five-table")).toBe("wrc-2025-red-five-table");
    // A new or unreadable device starts on Tenhou, the most commonly played set.
    expect(parseRulesPreference("removed-profile")).toBe("tenhou-hanchan");
    expect(parseRulesPreference(null)).toBe("tenhou-hanchan");
  });
});
