import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyWin, createSession } from "@riichimi/session-core";
import type { SessionState } from "@riichimi/session-core";
import { fireEvent, render, screen } from "@testing-library/react";
import { router } from "../src/navigation/router";

import { SessionScreen } from "../src/screens/session-screen";
import * as rulesPreferenceStorage from "../src/infrastructure/rules-preference-storage";
import * as sessionStorage from "../src/infrastructure/session-storage";
import { RulesProvider } from "../src/state/rules-context";
import { SessionProvider } from "../src/state/session-context";

vi.mock("../src/navigation/router", () => ({
  router: {
    back: vi.fn<typeof router.back>(),
    push: vi.fn<typeof router.push>(),
    replace: vi.fn<typeof router.replace>(),
  },
}));

vi.mock("../src/infrastructure/session-storage", () => ({
  loadStoredSession: vi.fn<typeof sessionStorage.loadStoredSession>().mockResolvedValue(null),
  saveStoredSession: vi.fn<typeof sessionStorage.saveStoredSession>().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.mocked(sessionStorage.loadStoredSession).mockResolvedValue(null);
});

vi.mock("../src/infrastructure/rules-preference-storage", () => ({
  loadRulesPreference: vi
    .fn<typeof rulesPreferenceStorage.loadRulesPreference>()
    .mockResolvedValue("wrc-2025"),
  saveRulesPreference: vi
    .fn<typeof rulesPreferenceStorage.saveRulesPreference>()
    .mockResolvedValue(undefined),
}));

function SessionUnderTest() {
  return (
    <RulesProvider>
      <SessionProvider>
        <SessionScreen />
      </SessionProvider>
    </RulesProvider>
  );
}

describe("SessionScreen", () => {
  it("starts and updates a locally managed table", async () => {
    render(<SessionUnderTest />);

    fireEvent.click(await screen.findByRole("button", { name: "Start East 1" }));

    expect(screen.getByRole("heading", { name: "East 1" })).toBeInTheDocument();
    expect(screen.getAllByText("25,000")).toHaveLength(4);

    const firstRiichiButton = screen.getAllByRole("button", { name: "Declare riichi" }).at(0);
    if (firstRiichiButton === undefined) {
      throw new Error("Expected a riichi control for the first player.");
    }
    fireEvent.click(firstRiichiButton);

    expect(screen.getByText("24,000")).toBeInTheDocument();
    expect(screen.getByLabelText("0 honba, 1 riichi stick")).toBeInTheDocument();
  });

  it("settles noten payments and exposes undo", async () => {
    render(<SessionUnderTest />);
    fireEvent.click(await screen.findByRole("button", { name: "Start East 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Exhaustive draw" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Player 1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Player 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Record draw & advance" }));

    expect(screen.getAllByText("26,500")).toHaveLength(2);
    expect(screen.getAllByText("23,500")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Undo last change" }));
    expect(screen.getAllByText("25,000")).toHaveLength(4);
  });

  it("pins the selected rules profile when East 1 starts", async () => {
    vi.mocked(rulesPreferenceStorage.loadRulesPreference).mockResolvedValueOnce(
      "wrc-2025-red-five-table",
    );
    render(<SessionUnderTest />);

    fireEvent.click(await screen.findByRole("button", { name: "Start East 1" }));

    expect(screen.getByText("WRC 2025 · RED-FIVE TABLE · PINNED")).toBeInTheDocument();
  });

  it("edits a completed draw round through a confirmed preview and undoes it", async () => {
    render(<SessionUnderTest />);
    fireEvent.click(await screen.findByRole("button", { name: "Start East 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Exhaustive draw" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Player 1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Player 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Record draw & advance" }));

    expect(screen.getAllByText("26,500")).toHaveLength(2);
    expect(screen.getAllByText("23,500")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Edit East 1 draw" }));

    // Drop Player 2 from the tenpai set, leaving only the dealer tenpai.
    fireEvent.click(screen.getByRole("checkbox", { name: "Player 2 tenpai" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    // Signed per-player final-score changes are shown before committing.
    expect(screen.getByText("Player 1: +1,500")).toBeInTheDocument();
    expect(screen.getByText(/^Player 2: .2,500$/)).toBeInTheDocument();
    expect(screen.getByText("Player 3: +500")).toBeInTheDocument();

    // "Keep as recorded" dismisses the confirmation without changing anything.
    fireEvent.click(screen.getByRole("button", { name: "Keep as recorded" }));
    expect(screen.getAllByText("26,500")).toHaveLength(2);
    expect(screen.getAllByText("23,500")).toHaveLength(2);

    // Re-preview, then commit the correction.
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply correction" }));

    expect(screen.getByText("28,000")).toBeInTheDocument();
    expect(screen.getAllByText("24,000")).toHaveLength(3);
    expect(
      screen.getByText("Round corrected. Scores updated. Undo is available."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo last change" }));
    expect(screen.getAllByText("26,500")).toHaveLength(2);
    expect(screen.getAllByText("23,500")).toHaveLength(2);
  });

  it("offers re-scoring a completed win round and routes to the calculator", async () => {
    const base = createSession({
      id: "table-win",
      playerNames: ["Aki", "Bo", "Cy", "Di"],
      rulesProfileId: "wrc-2025",
      startedAt: "2026-07-01T00:00:00.000Z",
    });
    const seeded: SessionState = applyWin(base, {
      discarderIndex: 0,
      id: "round-win-1",
      occurredAt: "2026-07-01T00:05:00.000Z",
      payments: { fromDiscarder: 5200, kind: "ron", total: 5200 },
      winnerIndex: 1,
    });
    vi.mocked(sessionStorage.loadStoredSession).mockResolvedValue(seeded);

    render(<SessionUnderTest />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit East 1, Bo won" }));

    const rescore = screen.getByRole("button", { name: "Re-score this hand" });
    expect(rescore).toBeInTheDocument();

    fireEvent.click(rescore);
    expect(vi.mocked(router.push)).toHaveBeenCalledWith({
      params: { editRound: "round-win-1" },
      pathname: "/manual",
    });
  });

  it("reveals a copyable game summary reflecting the round history", async () => {
    render(<SessionUnderTest />);
    fireEvent.click(await screen.findByRole("button", { name: "Start East 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Exhaustive draw" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Player 1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Player 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Record draw & advance" }));

    fireEvent.click(screen.getByRole("button", { name: "Show summary" }));

    const block = screen.getByLabelText("Shareable game summary");
    expect(block).toHaveTextContent(/1 round \(0 wins, 1 draw\)/);
    expect(block).toHaveTextContent(/1\. Player 1 — 26,500 \(\+1,500\)/);
    expect(block).toHaveTextContent(/Exhaustive draw — 2 tenpai/);

    fireEvent.click(screen.getByRole("button", { name: "Hide summary" }));
    expect(screen.queryByLabelText("Shareable game summary")).toBeNull();
  });
});
