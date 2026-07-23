import type { SessionState } from "@richii/session-core";
import { isScoringRulesProfileId } from "@richii/rules";

function isStoredSession(value: unknown): value is SessionState {
  if (
    typeof value !== "object" ||
    value === null ||
    !("table" in value) ||
    !("undoStack" in value) ||
    !Array.isArray(value.undoStack)
  ) {
    return false;
  }
  const table = value.table;
  return (
    typeof table === "object" &&
    table !== null &&
    "id" in table &&
    typeof table.id === "string" &&
    "players" in table &&
    Array.isArray(table.players) &&
    table.players.length === 4 &&
    "history" in table &&
    Array.isArray(table.history) &&
    "rulesProfileId" in table &&
    typeof table.rulesProfileId === "string" &&
    isScoringRulesProfileId(table.rulesProfileId)
  );
}

function migrateTable(value: unknown): unknown {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  if (
    "rulesProfileId" in value &&
    typeof value.rulesProfileId === "string" &&
    isScoringRulesProfileId(value.rulesProfileId)
  ) {
    return value;
  }
  return { ...value, rulesProfileId: "wrc-2025" };
}

export function parseStoredSession(serialized: string): SessionState {
  const input: unknown = JSON.parse(serialized);
  const migrated =
    typeof input === "object" &&
    input !== null &&
    "table" in input &&
    "undoStack" in input &&
    Array.isArray(input.undoStack)
      ? {
          ...input,
          table: migrateTable(input.table),
          undoStack: input.undoStack.map(migrateTable),
        }
      : input;
  if (!isStoredSession(migrated)) {
    throw new Error("The saved session has an unsupported format.");
  }
  return migrated;
}
