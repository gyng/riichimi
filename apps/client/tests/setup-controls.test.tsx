import { fireEvent, render, screen } from "@testing-library/react-native";

import { SettingsScreen } from "../src/screens/settings-screen";
import * as houseRulesStorage from "../src/infrastructure/house-rules-storage";
import * as localeStorage from "../src/infrastructure/locale-preference-storage";
import * as rulesStorage from "../src/infrastructure/rules-preference-storage";
import * as tileStorage from "../src/infrastructure/tile-display-storage";
import { LocaleProvider } from "../src/state/locale-context";
import { RulesProvider } from "../src/state/rules-context";
import { SessionProvider } from "../src/state/session-context";
import { TileLabelProvider } from "../src/state/tile-display-context";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), navigate: jest.fn(), push: jest.fn(), replace: jest.fn() },
  usePathname: () => "/settings",
}));

jest.mock("../src/infrastructure/rules-preference-storage", () => ({
  loadRulesPreference: jest.fn().mockResolvedValue("tenhou-hanchan"),
  saveRulesPreference: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/infrastructure/locale-preference-storage", () => ({
  loadLocalePreference: jest.fn().mockResolvedValue("en"),
  saveLocalePreference: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/infrastructure/tile-display-storage", () => ({
  loadTileLabelPreference: jest.fn().mockResolvedValue(false),
  saveTileLabelPreference: jest.fn().mockResolvedValue(undefined),
}));

const defaultHouse = {
  allowOpenTanyao: true,
  countedLimit: "yonbaiman",
  doubleWindPairFu: 2,
  kiriageMangan: false,
  label: "House rules",
  redFives: true,
  uraDora: true,
  yakumanStacking: "additive",
} as const;

jest.mock("../src/infrastructure/house-rules-storage", () => ({
  loadHouseRules: jest.fn(),
  saveHouseRules: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/infrastructure/session-storage", () => ({
  loadStoredSession: jest.fn().mockResolvedValue(null),
  saveStoredSession: jest.fn().mockResolvedValue(undefined),
}));

function setup() {
  return render(
    <LocaleProvider>
      <TileLabelProvider>
        <RulesProvider>
          <SessionProvider>
            <SettingsScreen />
          </SessionProvider>
        </RulesProvider>
      </TileLabelProvider>
    </LocaleProvider>,
  );
}

beforeEach(() => {
  jest.mocked(houseRulesStorage.loadHouseRules).mockResolvedValue({ ...defaultHouse });
});

describe("setup", () => {
  it("shows the stored profile and describes it from its own options", async () => {
    await setup();

    // Tenhou: red fives, open tanyao, no round-up mangan, kazoe yakuman, ura-dora.
    expect(
      await screen.findByText(/red fives · open tanyao · no round-up mangan/),
    ).toBeOnTheScreen();
  });

  it("remembers a different published ruleset", async () => {
    await setup();

    await fireEvent.press(screen.getByRole("radio", { name: "EMA Riichi 2016" }));

    expect(rulesStorage.saveRulesPreference).toHaveBeenCalledWith("ema-2016");
  });

  it("remembers the interface language", async () => {
    await setup();

    await fireEvent.press(screen.getByRole("radio", { name: "日本語" }));

    expect(localeStorage.saveLocalePreference).toHaveBeenCalledWith("ja");
  });

  it("remembers whether tiles show their rank", async () => {
    await setup();

    await fireEvent.press(screen.getByRole("checkbox", { name: /rank in the tile corner/ }));

    expect(tileStorage.saveTileLabelPreference).toHaveBeenCalledWith(true);
  });
});

describe("house rules", () => {
  it("edits an option and keeps the rest of the profile", async () => {
    await setup();
    await fireEvent.press(screen.getByRole("radio", { name: "House rules" }));

    await fireEvent.press(await screen.findByRole("checkbox", { name: /Red fives count as dora/ }));

    expect(houseRulesStorage.saveHouseRules).toHaveBeenCalledWith({
      ...defaultHouse,
      redFives: false,
    });
  });

  it("switches how a 13+ han hand is paid", async () => {
    await setup();
    await fireEvent.press(screen.getByRole("radio", { name: "House rules" }));

    await fireEvent.press(await screen.findByRole("radio", { name: "Cap at sanbaiman" }));

    expect(houseRulesStorage.saveHouseRules).toHaveBeenCalledWith({
      ...defaultHouse,
      countedLimit: "sanbaiman",
    });
  });

  it("switches whether combined yakuman add up", async () => {
    await setup();
    await fireEvent.press(screen.getByRole("radio", { name: "House rules" }));

    await fireEvent.press(await screen.findByRole("radio", { name: "Never combine" }));

    expect(houseRulesStorage.saveHouseRules).toHaveBeenCalledWith({
      ...defaultHouse,
      yakumanStacking: "single",
    });
  });

  it("describes the house profile from the options it was given", async () => {
    jest
      .mocked(houseRulesStorage.loadHouseRules)
      .mockResolvedValue({ ...defaultHouse, redFives: false, uraDora: false });
    await setup();

    await fireEvent.press(screen.getByRole("radio", { name: "House rules" }));

    expect(await screen.findByText(/no red fives .* no ura-dora/)).toBeOnTheScreen();
  });
});
