import type { SessionState } from "@richii/session-core";

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
    Array.isArray(table.history)
  );
}

export function parseStoredSession(serialized: string): SessionState {
  const parsed: unknown = JSON.parse(serialized);
  if (!isStoredSession(parsed)) {
    throw new Error("The saved session has an unsupported format.");
  }
  return parsed;
}
