import { fireEvent, render, screen } from "@testing-library/react-native";

import { ManualCalculator } from "../src/features/manual-calculator/manual-calculator";
import * as rulesPreferenceStorage from "../src/infrastructure/rules-preference-storage";
import * as scoreHistoryStorage from "../src/infrastructure/score-history-storage";
import { RulesProvider } from "../src/state/rules-context";
import { ScoreHistoryProvider } from "../src/state/score-history-context";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));

jest.mock("../src/infrastructure/score-history-storage", () => ({
  loadScoreHistory: jest.fn().mockResolvedValue(null),
  saveScoreHistory: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/infrastructure/rules-preference-storage", () => ({
  loadRulesPreference: jest.fn().mockResolvedValue("wrc-2025"),
  saveRulesPreference: jest.fn().mockResolvedValue(undefined),
}));

function CalculatorUnderTest() {
  return (
    <RulesProvider>
      <ScoreHistoryProvider>
        <ManualCalculator />
      </ScoreHistoryProvider>
    </RulesProvider>
  );
}

describe("ManualCalculator", () => {
  it("scores the complete worked example through the user-facing flow", async () => {
    await render(<CalculatorUnderTest />);

    await fireEvent.press(screen.getByRole("button", { name: "Try a scored example" }));
    await fireEvent.press(screen.getByRole("button", { name: "Calculate maximum score" }));

    expect(screen.getByText("2 han · 20 fu")).toBeOnTheScreen();
    expect(screen.getByText("Fully concealed hand")).toBeOnTheScreen();
    expect(screen.getAllByText("Pinfu")).toHaveLength(2);
    expect(screen.getByText("This audit is in your score folio.")).toBeOnTheScreen();
    expect(jest.mocked(scoreHistoryStorage.saveScoreHistory)).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: [
          expect.objectContaining({ rules: { id: "wrc-2025", label: "World Riichi Rules 2025" } }),
        ],
      }),
    );
  });

  it("explains the first missing input instead of producing a partial score", async () => {
    await render(<CalculatorUnderTest />);

    await fireEvent.press(screen.getByRole("button", { name: "Calculate maximum score" }));

    expect(screen.getByText(/Tap one hand tile to mark the winning tile/)).toBeOnTheScreen();
  });

  it("persists a red-five profile and exposes red tiles only for that profile", async () => {
    await render(<CalculatorUnderTest />);

    expect(screen.queryByRole("button", { name: "red five characters" })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("radio", { name: "WRC + red fives" }));

    expect(rulesPreferenceStorage.saveRulesPreference).toHaveBeenCalledWith(
      "wrc-2025-red-five-table",
    );
    expect(screen.getByRole("button", { name: "red five characters" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "red five circles" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "red five bamboo" })).toBeOnTheScreen();
  });
});
