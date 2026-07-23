import { parseStoredSession } from "./stored-session";

const legacyTable = {
  dealerIndex: 0,
  declaredRiichiPlayerIndices: [],
  handNumber: 1,
  history: [],
  honba: 0,
  id: "table-1",
  players: ["A", "B", "C", "D"].map((name, index) => ({
    id: `player-${index}`,
    name,
    score: 25_000,
  })),
  riichiSticks: 0,
  roundWind: "east",
  startedAt: "2026-07-23T00:00:00.000Z",
};

describe("stored table migration", () => {
  it("pins pre-profile tables and their undo history to WRC 2025", () => {
    expect(
      parseStoredSession(JSON.stringify({ table: legacyTable, undoStack: [legacyTable] })),
    ).toMatchObject({
      table: { rulesProfileId: "wrc-2025" },
      undoStack: [{ rulesProfileId: "wrc-2025" }],
    });
  });

  it("preserves an explicitly pinned profile", () => {
    expect(
      parseStoredSession(
        JSON.stringify({
          table: { ...legacyTable, rulesProfileId: "wrc-2025-red-five-table" },
          undoStack: [],
        }),
      ).table.rulesProfileId,
    ).toBe("wrc-2025-red-five-table");
  });

  it("falls back safely when a previously stored profile is no longer supported", () => {
    expect(
      parseStoredSession(
        JSON.stringify({
          table: { ...legacyTable, rulesProfileId: "retired-profile" },
          undoStack: [{ ...legacyTable, rulesProfileId: "retired-profile" }],
        }),
      ),
    ).toMatchObject({
      table: { rulesProfileId: "wrc-2025" },
      undoStack: [{ rulesProfileId: "wrc-2025" }],
    });
  });
});
