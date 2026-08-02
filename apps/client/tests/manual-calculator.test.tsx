import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyWin, createSession } from "@riichimi/session-core";
import type { SessionState } from "@riichimi/session-core";
import { fireEvent, render, screen } from "@testing-library/react";
import { useLocalSearchParams } from "../src/navigation/router";
import type { router } from "../src/navigation/router";

import type * as exampleHands from "../src/features/manual-calculator/example-hands";
import { ManualCalculator } from "../src/features/manual-calculator/manual-calculator";
import * as announcerPreferenceStorage from "../src/infrastructure/announcer-preference-storage";
import * as rulesPreferenceStorage from "../src/infrastructure/rules-preference-storage";
import * as scoreHistoryStorage from "../src/infrastructure/score-history-storage";
import * as sessionStorage from "../src/infrastructure/session-storage";

import { AnnouncerProvider } from "../src/state/announcer-context";
import { LocaleProvider } from "../src/state/locale-context";
import { RulesProvider } from "../src/state/rules-context";
import { ScoreHistoryProvider } from "../src/state/score-history-context";
import { SessionProvider } from "../src/state/session-context";

// The button deals a random hand now. These tests are about scoring a known
// one, so they pin it to the worked example rather than the randomiser.
vi.mock("../src/features/manual-calculator/example-hands", async (importOriginal) => {
  const actual = await importOriginal<typeof exampleHands>();
  return { ...actual, randomExampleHand: actual.workedExample };
});

vi.mock("../src/navigation/router", () => ({
  router: {
    back: vi.fn<typeof router.back>(),
    push: vi.fn<typeof router.push>(),
    replace: vi.fn<typeof router.replace>(),
  },
  useLocalSearchParams: vi.fn<typeof useLocalSearchParams>().mockReturnValue({}),
}));

vi.mock("../src/infrastructure/score-history-storage", () => ({
  loadScoreHistory: vi.fn<typeof scoreHistoryStorage.loadScoreHistory>().mockResolvedValue(null),
  saveScoreHistory: vi
    .fn<typeof scoreHistoryStorage.saveScoreHistory>()
    .mockResolvedValue(undefined),
}));

vi.mock("../src/infrastructure/rules-preference-storage", () => ({
  loadRulesPreference: vi
    .fn<typeof rulesPreferenceStorage.loadRulesPreference>()
    .mockResolvedValue("wrc-2025"),
  saveRulesPreference: vi
    .fn<typeof rulesPreferenceStorage.saveRulesPreference>()
    .mockResolvedValue(undefined),
}));

vi.mock("../src/infrastructure/session-storage", () => ({
  loadStoredSession: vi.fn<typeof sessionStorage.loadStoredSession>().mockResolvedValue(null),
  saveStoredSession: vi.fn<typeof sessionStorage.saveStoredSession>().mockResolvedValue(undefined),
}));

vi.mock("../src/infrastructure/announcer-preference-storage", () => ({
  loadAnnouncerPreference: vi
    .fn<typeof announcerPreferenceStorage.loadAnnouncerPreference>()
    .mockResolvedValue(false),
  saveAnnouncerPreference: vi
    .fn<typeof announcerPreferenceStorage.saveAnnouncerPreference>()
    .mockResolvedValue(undefined),
  loadCelebratePreference: vi
    .fn<typeof announcerPreferenceStorage.loadCelebratePreference>()
    .mockResolvedValue(true),
  saveCelebratePreference: vi
    .fn<typeof announcerPreferenceStorage.saveCelebratePreference>()
    .mockResolvedValue(undefined),
  loadAnnouncerVoice: vi
    .fn<typeof announcerPreferenceStorage.loadAnnouncerVoice>()
    .mockResolvedValue("system"),
  saveAnnouncerVoice: vi
    .fn<typeof announcerPreferenceStorage.saveAnnouncerVoice>()
    .mockResolvedValue(undefined),
}));

// Held in a plain binding rather than read back off the mocked module: the
// announcement is asserted by what was spoken, not by reaching through `speech`.
const { speak } = vi.hoisted(() => ({ speak: vi.fn<(text: string) => void>() }));

vi.mock("../src/infrastructure/speech", () => ({
  speech: { available: true, cancel: vi.fn<() => void>(), speak },
}));

function CalculatorUnderTest() {
  return (
    <LocaleProvider>
      <AnnouncerProvider>
        <RulesProvider>
          <ScoreHistoryProvider>
            <ManualCalculator />
          </ScoreHistoryProvider>
        </RulesProvider>
      </AnnouncerProvider>
    </LocaleProvider>
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
    <LocaleProvider>
      <AnnouncerProvider>
        <RulesProvider>
          <ScoreHistoryProvider>
            <SessionProvider>
              <ManualCalculator />
            </SessionProvider>
          </ScoreHistoryProvider>
        </RulesProvider>
      </AnnouncerProvider>
    </LocaleProvider>
  );
}

beforeEach(() => {
  vi.mocked(useLocalSearchParams).mockReturnValue({});
});

describe("ManualCalculator", () => {
  it("stays silent when the announce preference is off", async () => {
    render(<CalculatorUnderTest />);

    fireEvent.click(screen.getByRole("button", { name: "Try a scored example" }));
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

    expect(speak).not.toHaveBeenCalled();
  });

  it("speaks the scored result when the announce preference is on", async () => {
    vi.mocked(announcerPreferenceStorage.loadAnnouncerPreference).mockResolvedValueOnce(true);
    render(<CalculatorUnderTest />);
    // Let the stored preference resolve before scoring.
    await screen.findByRole("button", { name: "Try a scored example" });

    fireEvent.click(screen.getByRole("button", { name: "Try a scored example" }));
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

    expect(speak).toHaveBeenCalledWith("Tsumo. Menzen tsumo. Pinfu. 2 han 20 fu. 1,500 points.");
  });

  it("scores the complete worked example through the user-facing flow", async () => {
    render(<CalculatorUnderTest />);
    // The stored rules profile arrives asynchronously and the saved entry records
    // it, so wait for the chip to name it before scoring.
    await screen.findByText("WORLD RIICHI RULES 2025");

    fireEvent.click(screen.getByRole("button", { name: "Try a scored example" }));
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

    // Twice on purpose: the dock carries the answer so it is never below the
    // fold, and the audit panel repeats it at the head of its reasoning.
    expect(screen.getAllByText("2 han · 20 fu")).toHaveLength(2);
    expect(screen.getByText("Fully concealed hand")).toBeInTheDocument();
    expect(screen.getAllByText("Pinfu")).toHaveLength(2);
    expect(screen.getByText("Saved to your folio.")).toBeInTheDocument();
    expect(vi.mocked(scoreHistoryStorage.saveScoreHistory)).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: [
          expect.objectContaining({ rules: { id: "wrc-2025", label: "World Riichi Rules 2025" } }),
        ],
      }),
    );
  });

  it("puts the announcer beside the score it reads, and replays that score on request", async () => {
    // The panel takes the replay as a prop and renders nothing without it, so
    // the controls can be present, correct, and reach no voice at all.
    vi.mocked(announcerPreferenceStorage.loadAnnouncerPreference).mockResolvedValueOnce(true);
    render(<CalculatorUnderTest />);
    await screen.findByRole("button", { name: "Try a scored example" });

    fireEvent.click(screen.getByRole("button", { name: "Try a scored example" }));
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
    speak.mockClear();
    fireEvent.click(await screen.findByRole("button", { name: "Say it again" }));

    expect(speak).toHaveBeenCalledWith("Tsumo. Menzen tsumo. Pinfu. 2 han 20 fu. 1,500 points.");
  });

  it("offers another hand once one has been dealt, so pressing again is possible", async () => {
    // The offer used to live only in the empty hand, which made the second
    // press unreachable: one example was all anyone could ever see.
    render(<CalculatorUnderTest />);

    expect(screen.queryByRole("button", { name: "Deal another" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try a scored example" }));
    fireEvent.click(screen.getByRole("button", { name: "Deal another" }));

    expect(screen.getByRole("button", { name: "Deal another" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Calculate" })).toBeInTheDocument();
  });

  it("withdraws the offer once the dealt hand has been edited", async () => {
    // Dealing over tiles somebody chose themselves would discard work with no
    // way back, so the offer stands only while the hand is untouched.
    render(<CalculatorUnderTest />);

    fireEvent.click(screen.getByRole("button", { name: "Try a scored example" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Remove .* from hand/ })[0]!);

    expect(screen.queryByRole("button", { name: "Deal another" })).not.toBeInTheDocument();
  });

  it("keeps the answer and the action in one place, so neither is scrolled away", async () => {
    // The hand, picker, and context run to about two and a half screens on a
    // phone, so a score rendered after them is off screen at the moment it is
    // produced. The dock holds whichever of the two is currently useful.
    render(<CalculatorUnderTest />);
    await screen.findByText("WORLD RIICHI RULES 2025");

    const dock = screen.getByRole("button", { name: "Calculate" }).closest("div");
    expect(dock).not.toBeNull();
    expect(dock?.textContent).not.toContain("han");

    fireEvent.click(screen.getByRole("button", { name: "Try a scored example" }));
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

    // Calculate has done its job and given its place to the score.
    expect(screen.queryByRole("button", { name: "Calculate" })).not.toBeInTheDocument();
    const audit = screen.getByRole("button", { name: "See the audit" });
    expect(audit.closest("div")?.textContent).toContain("2 han · 20 fu");
    expect(audit.closest("div")?.textContent).toContain("700 / 400");
  });

  it("hands the dock back to Calculate the moment the hand changes", async () => {
    render(<CalculatorUnderTest />);
    await screen.findByText("WORLD RIICHI RULES 2025");
    fireEvent.click(screen.getByRole("button", { name: "Try a scored example" }));
    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
    expect(screen.getByRole("button", { name: "See the audit" })).toBeInTheDocument();

    // Any edit invalidates the answer, so the dock must stop showing one.
    fireEvent.click(screen.getByRole("radio", { name: "Ron" }));

    expect(screen.getByRole("button", { name: "Calculate" })).toBeInTheDocument();
    expect(screen.queryByText("2 han · 20 fu")).not.toBeInTheDocument();
  });

  it("says what is wrong in the dock when a hand cannot score", async () => {
    render(<CalculatorUnderTest />);
    await screen.findByText("WORLD RIICHI RULES 2025");

    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

    // A failed calculation is still an answer, and it belongs in the same place.
    const why = screen.getByRole("button", { name: "See why" });
    expect(why.closest("div")?.textContent).toContain("Check the hand");
  });

  it("explains the first missing input instead of producing a partial score", async () => {
    render(<CalculatorUnderTest />);

    fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

    expect(screen.getByText(/Tap one hand tile to mark the winning tile/)).toBeInTheDocument();
  });

  it("offers red tiles only when the active profile has them", async () => {
    render(<CalculatorUnderTest />);
    // WRC 2025 has no red fives. Wait for it to be the active profile, so this
    // asserts the loaded rules rather than whatever was showing before they came.
    await screen.findByText("WORLD RIICHI RULES 2025");

    expect(screen.queryByRole("button", { name: "red five characters" })).not.toBeInTheDocument();
  });

  it("exposes red tiles for a stored red-five profile", async () => {
    vi.mocked(rulesPreferenceStorage.loadRulesPreference).mockResolvedValueOnce(
      "wrc-2025-red-five-table",
    );
    render(<CalculatorUnderTest />);

    expect(await screen.findByRole("button", { name: "red five characters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "red five circles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "red five bamboo" })).toBeInTheDocument();
  });

  describe("re-scoring a completed win round", () => {
    beforeEach(() => {
      vi.mocked(useLocalSearchParams).mockReturnValue({ editRound: "round-edit-1" });
      vi.mocked(sessionStorage.loadStoredSession).mockResolvedValue(seededSession());
    });

    it("seeds the winner and context from the round being edited", async () => {
      render(<CalculatorInSession />);

      expect(await screen.findByText("EDITING RECORDED ROUND")).toBeInTheDocument();
      // Winner seeded from the record (Bo, index 1). Seeding runs off the loaded
      // round, a tick behind the banner above.
      expect(await screen.findByRole("radio", { name: "Bo", checked: true })).toBeInTheDocument();
      // Ron method seeded (Bo won by ron off Aki).
      expect(screen.getByRole("radio", { name: "Ron", checked: true })).toBeInTheDocument();
      // Context fields are editable defaults in edit mode, not locked to the table.
      // They sit behind the round-context disclosure so a hand needs less scrolling.
      fireEvent.click(screen.getByRole("button", { name: "Round and seat details" }));
      expect(screen.getByLabelText("SEAT WIND")).toBeInTheDocument();
      expect(screen.getByLabelText("Increase Honba")).toBeInTheDocument();
    });

    it("re-scores, confirms the signed change, and replaces the recorded round", async () => {
      render(<CalculatorInSession />);
      await screen.findByText("EDITING RECORDED ROUND");

      // Re-score the hand as the worked pinfu-tsumo example.
      fireEvent.click(screen.getByRole("button", { name: "Try a scored example" }));
      fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
      expect(screen.getAllByText("2 han · 20 fu").length).toBeGreaterThan(0);

      fireEvent.click(screen.getByRole("button", { name: "Save correction" }));

      // The confirmation surface shows per-seat signed score changes.
      expect(screen.getByText("Confirm this correction")).toBeInTheDocument();
      expect(screen.getByText(/^Aki: [+−]/)).toBeInTheDocument();
      expect(screen.getByText(/^Bo: [+−]/)).toBeInTheDocument();

      vi.mocked(sessionStorage.saveStoredSession).mockClear();
      fireEvent.click(screen.getByRole("button", { name: "Update this round" }));

      // The edit committed: the recorded round's payment is now a tsumo, and we
      // returned to the session.
      const saved = vi
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
