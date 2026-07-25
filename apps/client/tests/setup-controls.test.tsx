import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { router } from "../src/navigation/router";

import { SettingsScreen } from "../src/screens/settings-screen";
import * as houseRulesStorage from "../src/infrastructure/house-rules-storage";
import * as localeStorage from "../src/infrastructure/locale-preference-storage";
import * as rulesStorage from "../src/infrastructure/rules-preference-storage";
import * as tileStorage from "../src/infrastructure/tile-display-storage";
import { LocaleProvider } from "../src/state/locale-context";
import { RulesProvider } from "../src/state/rules-context";
import { SessionProvider } from "../src/state/session-context";
import { TileLabelProvider } from "../src/state/tile-display-context";

vi.mock("../src/navigation/router", () => ({
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
    .fn<typeof rulesStorage.loadRulesPreference>()
    .mockResolvedValue("tenhou-hanchan"),
  saveRulesPreference: vi
    .fn<typeof rulesStorage.saveRulesPreference>()
    .mockResolvedValue(undefined),
}));

vi.mock("../src/infrastructure/locale-preference-storage", () => ({
  loadLocalePreference: vi.fn<typeof localeStorage.loadLocalePreference>().mockResolvedValue("en"),
  saveLocalePreference: vi
    .fn<typeof localeStorage.saveLocalePreference>()
    .mockResolvedValue(undefined),
}));

vi.mock("../src/infrastructure/tile-display-storage", () => ({
  loadTileLabelPreference: vi
    .fn<typeof tileStorage.loadTileLabelPreference>()
    .mockResolvedValue(false),
  saveTileLabelPreference: vi
    .fn<typeof tileStorage.saveTileLabelPreference>()
    .mockResolvedValue(undefined),
}));

const defaultHouse = {
  allowOpenTanyao: true,
  countedLimit: "yonbaiman",
  doubleWindPairFu: 2,
  doubleYakuman: false,
  kiriageMangan: false,
  label: "House rules",
  redFives: true,
  uraDora: true,
  yakumanStacking: "additive",
} as const;

vi.mock("../src/infrastructure/house-rules-storage", () => ({
  loadHouseRules: vi.fn<typeof houseRulesStorage.loadHouseRules>(),
  saveHouseRules: vi.fn<typeof houseRulesStorage.saveHouseRules>().mockResolvedValue(undefined),
}));

vi.mock("../src/infrastructure/session-storage", () => ({
  loadStoredSession: vi.fn<typeof sessionStorage.loadStoredSession>().mockResolvedValue(null),
  saveStoredSession: vi.fn<typeof sessionStorage.saveStoredSession>().mockResolvedValue(undefined),
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
  vi.mocked(houseRulesStorage.loadHouseRules).mockResolvedValue({ ...defaultHouse });
});

describe("setup", () => {
  it("shows the stored profile and describes it from its own options", async () => {
    setup();

    // Tenhou: red fives, open tanyao, no round-up mangan, kazoe yakuman, ura-dora.
    expect(
      await screen.findByText(/red fives · open tanyao · no round-up mangan/),
    ).toBeInTheDocument();
  });

  it("remembers a different published ruleset", async () => {
    setup();

    fireEvent.click(screen.getByRole("radio", { name: "EMA Riichi 2016" }));

    expect(rulesStorage.saveRulesPreference).toHaveBeenCalledWith("ema-2016");
  });

  it("remembers the interface language", async () => {
    setup();

    fireEvent.click(screen.getByRole("radio", { name: "日本語" }));

    expect(localeStorage.saveLocalePreference).toHaveBeenCalledWith("ja");
  });

  it("remembers whether tiles show their rank", async () => {
    setup();

    fireEvent.click(screen.getByRole("checkbox", { name: /rank in the tile corner/ }));

    expect(tileStorage.saveTileLabelPreference).toHaveBeenCalledWith(true);
  });
});

describe("house rules", () => {
  it("edits an option and keeps the rest of the profile", async () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: "House rules" }));

    fireEvent.click(await screen.findByRole("checkbox", { name: /Red fives count as dora/ }));

    expect(houseRulesStorage.saveHouseRules).toHaveBeenCalledWith({
      ...defaultHouse,
      redFives: false,
    });
  });

  it("switches how a 13+ han hand is paid", async () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: "House rules" }));

    fireEvent.click(await screen.findByRole("radio", { name: "Cap at sanbaiman" }));

    expect(houseRulesStorage.saveHouseRules).toHaveBeenCalledWith({
      ...defaultHouse,
      countedLimit: "sanbaiman",
    });
  });

  it("switches whether combined yakuman add up", async () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: "House rules" }));

    fireEvent.click(await screen.findByRole("radio", { name: "Never combine" }));

    expect(houseRulesStorage.saveHouseRules).toHaveBeenCalledWith({
      ...defaultHouse,
      yakumanStacking: "single",
    });
  });

  it("describes the house profile from the options it was given", async () => {
    vi.mocked(houseRulesStorage.loadHouseRules).mockResolvedValue({
      ...defaultHouse,
      redFives: false,
      uraDora: false,
    });
    setup();

    fireEvent.click(screen.getByRole("radio", { name: "House rules" }));

    expect(await screen.findByText(/no red fives .* no ura-dora/)).toBeInTheDocument();
  });
});
