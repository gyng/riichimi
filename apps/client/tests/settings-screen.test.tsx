import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { router } from "expo-router";

import type * as HouseStorage from "../src/infrastructure/house-rules-storage";
import type * as LocaleStorage from "../src/infrastructure/locale-preference-storage";

import { SettingsScreen } from "../src/screens/settings-screen";
import * as rulesPreferenceStorage from "../src/infrastructure/rules-preference-storage";
import { LocaleProvider } from "../src/state/locale-context";
import { RulesProvider } from "../src/state/rules-context";
import { SessionProvider } from "../src/state/session-context";

vi.mock("expo-router", () => ({
  router: {
    back: vi.fn<typeof router.back>(),
    navigate: vi.fn<typeof router.navigate>(),
    push: vi.fn<typeof router.push>(),
    replace: vi.fn<typeof router.replace>(),
  },
  usePathname: () => "/settings",
}));

vi.mock("../src/infrastructure/rules-preference-storage", () => ({
  loadRulesPreference: vi
    .fn<typeof rulesPreferenceStorage.loadRulesPreference>()
    .mockResolvedValue("wrc-2025"),
  saveRulesPreference: vi
    .fn<typeof rulesPreferenceStorage.saveRulesPreference>()
    .mockResolvedValue(undefined),
}));

vi.mock("../src/infrastructure/locale-preference-storage", () => ({
  loadLocalePreference: vi.fn<typeof LocaleStorage.loadLocalePreference>().mockResolvedValue("en"),
  saveLocalePreference: vi
    .fn<typeof LocaleStorage.saveLocalePreference>()
    .mockResolvedValue(undefined),
}));

vi.mock("../src/infrastructure/house-rules-storage", () => ({
  loadHouseRules: vi.fn<typeof HouseStorage.loadHouseRules>().mockResolvedValue({
    allowOpenTanyao: true,
    countedLimit: "yonbaiman",
    doubleWindPairFu: 2,
    doubleYakuman: false,
    kiriageMangan: false,
    label: "House rules",
    redFives: true,
    uraDora: true,
    yakumanStacking: "additive",
  }),
  saveHouseRules: vi.fn<typeof HouseStorage.saveHouseRules>().mockResolvedValue(undefined),
}));

vi.mock("../src/infrastructure/session-storage", () => ({
  loadStoredSession: vi.fn<typeof sessionStorage.loadStoredSession>().mockResolvedValue(null),
  saveStoredSession: vi.fn<typeof sessionStorage.saveStoredSession>().mockResolvedValue(undefined),
}));

function SettingsUnderTest() {
  return (
    <LocaleProvider>
      <RulesProvider>
        <SessionProvider>
          <SettingsScreen />
        </SessionProvider>
      </RulesProvider>
    </LocaleProvider>
  );
}

describe("SettingsScreen", () => {
  it("keeps setup off the play surfaces and persists a rules choice", async () => {
    render(<SettingsUnderTest />);

    fireEvent.click(screen.getByRole("radio", { name: "WRC 2025 · red-five table" }));

    expect(rulesPreferenceStorage.saveRulesPreference).toHaveBeenCalledWith(
      "wrc-2025-red-five-table",
    );
  });

  it("offers the interface language here rather than mid-hand", async () => {
    render(<SettingsUnderTest />);

    expect(screen.getByRole("radio", { name: "日本語" })).toBeInTheDocument();
  });
});
