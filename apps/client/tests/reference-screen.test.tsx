import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type * as HouseStorage from "../src/infrastructure/house-rules-storage";
import type * as LocaleStorage from "../src/infrastructure/locale-preference-storage";
import type * as rulesPreferenceStorage from "../src/infrastructure/rules-preference-storage";

import { LocaleProvider } from "../src/state/locale-context";
import { ReferenceScreen } from "../src/screens/reference-screen";
import { RulesProvider } from "../src/state/rules-context";

vi.mock("../src/infrastructure/rules-preference-storage", () => ({
  loadRulesPreference: vi
    .fn<typeof rulesPreferenceStorage.loadRulesPreference>()
    .mockResolvedValue("tenhou-hanchan"),
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

function renderReference() {
  return render(
    <LocaleProvider>
      <RulesProvider>
        <ReferenceScreen />
      </RulesProvider>
    </LocaleProvider>,
  );
}

describe("the reference", () => {
  it("lists a yaku under the han it is worth, with the name printed at a table", () => {
    renderReference();

    expect(screen.getByRole("heading", { name: "1 han" })).toBeInTheDocument();
    expect(screen.getByText("立直")).toBeInTheDocument();
    expect(
      screen.getByText("Declared while closed and one tile from a win, staking 1,000 points."),
    ).toBeInTheDocument();
    // A yakuman has no han, so it gets a band of its own rather than a number.
    expect(screen.getByRole("heading", { name: "Yakuman" })).toBeInTheDocument();
    expect(screen.getByText("国士無双")).toBeInTheDocument();
  });

  it("says which yaku a called set forfeits", () => {
    renderReference();

    // The one thing a player most often gets wrong about a yaku they can see.
    expect(screen.getAllByText("closed only").length).toBeGreaterThan(0);
    expect(screen.getByText("5 open")).toBeInTheDocument();
  });

  it("finds a yaku by its reading as readily as by its name", () => {
    renderReference();

    fireEvent.change(screen.getByLabelText("FIND A YAKU"), { target: { value: "chiitoitsu" } });

    expect(screen.getByText("七対子")).toBeInTheDocument();
    expect(screen.queryByText("立直")).not.toBeInTheDocument();
  });

  it("says so when nothing matches, rather than showing an empty page", () => {
    renderReference();

    fireEvent.change(screen.getByLabelText("FIND A YAKU"), { target: { value: "zzzz" } });

    expect(screen.getByText("Nothing matches that.")).toBeInTheDocument();
  });

  it("gives the fu table the same wording the score audit uses", () => {
    renderReference();

    fireEvent.click(screen.getByRole("radio", { name: "Fu" }));

    expect(screen.getByText("Winning hand")).toBeInTheDocument();
    expect(screen.getByText("Concealed terminal/honour triplet")).toBeInTheDocument();
    expect(screen.getByText("+32")).toBeInTheDocument();
  });

  it("marks which ruleset the app is scoring by right now", async () => {
    renderReference();

    fireEvent.click(screen.getByRole("radio", { name: "Rulesets" }));

    // The stored profile arrives asynchronously, and the tag has to follow it:
    // a reference that says a different ruleset is in use than the scorer is
    // using is worse than one that says nothing.
    expect(await screen.findByText("IN USE")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tenhou · ranked" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "World Riichi Rules 2025" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Read the published rules" }).length,
    ).toBeGreaterThan(0);
  });
});
