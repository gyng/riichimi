import { applyWin, createSession } from "@riichimi/session-core";
import type { SessionState } from "@riichimi/session-core";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";

import { ManualCalculator } from "../src/features/manual-calculator/manual-calculator";
import * as rulesPreferenceStorage from "../src/infrastructure/rules-preference-storage";
import * as scoreHistoryStorage from "../src/infrastructure/score-history-storage";
import * as sessionStorage from "../src/infrastructure/session-storage";
import { RulesProvider } from "../src/state/rules-context";
import { ScoreHistoryProvider } from "../src/state/score-history-context";
import { SessionProvider } from "../src/state/session-context";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn().mockReturnValue({}),
}));

jest.mock("../src/infrastructure/score-history-storage", () => ({
  loadScoreHistory: jest.fn().mockResolvedValue(null),
  saveScoreHistory: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/infrastructure/rules-preference-storage", () => ({
  loadRulesPreference: jest.fn().mockResolvedValue("wrc-2025"),
  saveRulesPreference: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/infrastructure/session-storage", () => ({
  loadStoredSession: jest.fn().mockResolvedValue(null),
  saveStoredSession: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/infrastructure/announcer-preference-storage", () => ({
  loadAnnouncerPreference: jest.fn().mockResolvedValue(false),
  saveAnnouncerPreference: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/infrastructure/speech", () => ({
  speech: { available: true, cancel: jest.fn(), speak: jest.fn() },
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

function seededSession(): SessionState {
  const base = createSession({
    id: "table-edit",
    playerNames: ["Aki", "Bo", "Cy", "Di"],
    rulesProfileId: "wrc-2025",
    startedAt: "2026-07-01T00:00:00.000Z",
  });
  // Non-dealer Bo (index 1) rons dealer Aki (index 0) for 5,200 at East 1.
  return applyWin(base, {
    discarderIndex: 0,
    id: "round-edit-1",
    occurredAt: "2026-07-01T00:05:00.000Z",
    payments: { fromDiscarder: 5200, kind: "ron", total: 5200 },
    winnerIndex: 1,
  });
}

function CalculatorInSession() {
  return (
    <RulesProvider>
      <ScoreHistoryProvider>
        <SessionProvider>
          <ManualCalculator />
        </SessionProvider>
      </ScoreHistoryProvider>
    </RulesProvider>
  );
}

beforeEach(() => {
  jest.mocked(useLocalSearchParams).mockReturnValue({});
});

describe("ManualCalculator", () => {
  it("stays silent until announcing is turned on, then speaks the scored result", async () => {
    const { speech } = jest.requireMock<{
      speech: { cancel: jest.Mock; speak: jest.Mock };
    }>("../src/infrastructure/speech");
    await render(<CalculatorUnderTest />);

    await fireEvent.press(screen.getByRole("button", { name: "Try a scored example" }));
    await fireEvent.press(screen.getByRole("button", { name: "Calculate" }));
    expect(speech.speak).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("checkbox", { name: /Announce result/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Calculate" }));

    expect(speech.speak).toHaveBeenCalledWith(
      "Tsumo, Menzen tsumo, Pinfu, 2 han 20 fu, 1,500 points.",
    );
  });

  it("scores the complete worked example through the user-facing flow", async () => {
    await render(<CalculatorUnderTest />);

    await fireEvent.press(screen.getByRole("button", { name: "Try a scored example" }));
    await fireEvent.press(screen.getByRole("button", { name: "Calculate" }));

    expect(screen.getByText("2 han · 20 fu")).toBeOnTheScreen();
    expect(screen.getByText("Fully concealed hand")).toBeOnTheScreen();
    expect(screen.getAllByText("Pinfu")).toHaveLength(2);
    expect(screen.getByText("Saved to your folio.")).toBeOnTheScreen();
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

    await fireEvent.press(screen.getByRole("button", { name: "Calculate" }));

    expect(screen.getByText(/Tap one hand tile to mark the winning tile/)).toBeOnTheScreen();
  });

  it("offers red tiles only when the active profile has them", async () => {
    await render(<CalculatorUnderTest />);

    expect(screen.queryByRole("button", { name: "red five characters" })).not.toBeOnTheScreen();
  });

  it("exposes red tiles for a stored red-five profile", async () => {
    jest
      .mocked(rulesPreferenceStorage.loadRulesPreference)
      .mockResolvedValueOnce("wrc-2025-red-five-table");
    await render(<CalculatorUnderTest />);

    expect(await screen.findByRole("button", { name: "red five characters" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "red five circles" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "red five bamboo" })).toBeOnTheScreen();
  });

  describe("re-scoring a completed win round", () => {
    beforeEach(() => {
      jest.mocked(useLocalSearchParams).mockReturnValue({ editRound: "round-edit-1" });
      jest.mocked(sessionStorage.loadStoredSession).mockResolvedValue(seededSession());
    });

    it("seeds the winner and context from the round being edited", async () => {
      await render(<CalculatorInSession />);

      expect(await screen.findByText("EDITING RECORDED ROUND")).toBeOnTheScreen();
      // Winner seeded from the record (Bo, index 1).
      expect(screen.getByRole("radio", { name: "Bo", checked: true })).toBeOnTheScreen();
      // Ron method seeded (Bo won by ron off Aki).
      expect(screen.getByRole("radio", { name: "Ron", checked: true })).toBeOnTheScreen();
      // Context fields are editable defaults in edit mode, not locked to the table.
      // They sit behind the round-context disclosure so a hand needs less scrolling.
      await fireEvent.press(screen.getByRole("button", { name: "Round and seat details" }));
      expect(screen.getByLabelText("Seat wind")).toBeOnTheScreen();
      expect(screen.getByLabelText("Increase Honba")).toBeOnTheScreen();
    });

    it("re-scores, confirms the signed change, and replaces the recorded round", async () => {
      await render(<CalculatorInSession />);
      await screen.findByText("EDITING RECORDED ROUND");

      // Re-score the hand as the worked pinfu-tsumo example.
      await fireEvent.press(screen.getByRole("button", { name: "Try a scored example" }));
      await fireEvent.press(screen.getByRole("button", { name: "Calculate" }));
      expect(screen.getByText("2 han · 20 fu")).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole("button", { name: "Save correction" }));

      // The confirmation surface shows per-seat signed score changes.
      expect(screen.getByText("Confirm this correction")).toBeOnTheScreen();
      expect(screen.getByText(/^Aki: [+−]/)).toBeOnTheScreen();
      expect(screen.getByText(/^Bo: [+−]/)).toBeOnTheScreen();

      jest.mocked(sessionStorage.saveStoredSession).mockClear();
      await fireEvent.press(screen.getByRole("button", { name: "Update this round" }));

      // The edit committed: the recorded round's payment is now a tsumo, and we
      // returned to the session.
      const saved = jest
        .mocked(sessionStorage.saveStoredSession)
        .mock.calls.map((call) => call[0])
        .find((state): state is SessionState => state !== null);
      if (saved === undefined) {
        throw new Error("Expected the edited session to be persisted.");
      }
      const record = saved.table.history.find((item) => item.id === "round-edit-1");
      expect(record).toMatchObject({
        kind: "win",
        payments: expect.objectContaining({ kind: "tsumo" }),
      });
    });
  });
});
