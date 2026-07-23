import { fireEvent, render, screen } from "@testing-library/react-native";

import { SettingsScreen } from "../src/screens/settings-screen";
import * as rulesPreferenceStorage from "../src/infrastructure/rules-preference-storage";
import { LocaleProvider } from "../src/state/locale-context";
import { RulesProvider } from "../src/state/rules-context";
import { SessionProvider } from "../src/state/session-context";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), navigate: jest.fn(), push: jest.fn(), replace: jest.fn() },
  usePathname: () => "/settings",
}));

jest.mock("../src/infrastructure/rules-preference-storage", () => ({
  loadRulesPreference: jest.fn().mockResolvedValue("wrc-2025"),
  saveRulesPreference: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/infrastructure/locale-preference-storage", () => ({
  loadLocalePreference: jest.fn().mockResolvedValue("en"),
  saveLocalePreference: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/infrastructure/house-rules-storage", () => ({
  loadHouseRules: jest.fn().mockResolvedValue({
    allowOpenTanyao: true,
    countedLimit: "yonbaiman",
    doubleWindPairFu: 2,
    kiriageMangan: false,
    label: "House rules",
    redFives: true,
    uraDora: true,
    yakumanStacking: "additive",
  }),
  saveHouseRules: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/infrastructure/session-storage", () => ({
  loadStoredSession: jest.fn().mockResolvedValue(null),
  saveStoredSession: jest.fn().mockResolvedValue(undefined),
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
    await render(<SettingsUnderTest />);

    await fireEvent.press(screen.getByRole("radio", { name: "WRC 2025 · red-five table" }));

    expect(rulesPreferenceStorage.saveRulesPreference).toHaveBeenCalledWith(
      "wrc-2025-red-five-table",
    );
  });

  it("offers the interface language here rather than mid-hand", async () => {
    await render(<SettingsUnderTest />);

    expect(screen.getByRole("radio", { name: "日本語" })).toBeOnTheScreen();
  });
});
