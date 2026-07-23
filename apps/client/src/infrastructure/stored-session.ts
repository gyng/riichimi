import type { SessionEvent, SessionState, TableState } from "@riichimi/session-core";
import { reconstructSessionFromSnapshots, replaySessionEvents } from "@riichimi/session-core";
import { isScoringRulesProfileId } from "@riichimi/rules";

// Boundary shape check for a persisted TableState. Model output and stored JSON
// are untrusted, so the base snapshot is validated structurally before any
// domain code (replay, reconstruction) folds events over it.
function isValidTable(value: unknown): value is TableState {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "players" in value &&
    Array.isArray(value.players) &&
    value.players.length === 4 &&
    "history" in value &&
    Array.isArray(value.history) &&
    "declaredRiichiPlayerIndices" in value &&
    Array.isArray(value.declaredRiichiPlayerIndices) &&
    "rulesProfileId" in value &&
    typeof value.rulesProfileId === "string" &&
    isScoringRulesProfileId(value.rulesProfileId)
  );
}

// Pin legacy tables that predate rules profiles (or reference a retired profile)
// to the current default. Preserves an explicitly supported profile as-is.
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

function isEventArray(value: unknown): value is readonly SessionEvent[] {
  return (
    Array.isArray(value) && value.every((event) => typeof event === "object" && event !== null)
  );
}

// Adopt a session already in the event-sourced shape (stored v2, or an
// in-flight new-shape document without a version marker). The persisted `table`
// is not trusted as truth: replay of `events` over `base` rebuilds it and
// doubles as an integrity check.
function adoptEventSourced(base: unknown, events: unknown, undoStack: unknown): SessionState {
  const migratedBase = migrateTable(base);
  if (!isValidTable(migratedBase) || !isEventArray(events)) {
    throw new Error("The saved session has an unsupported format.");
  }
  const replayed = replaySessionEvents(migratedBase, events);
  if (replayed.kind !== "replayed") {
    throw new Error("The saved session could not be replayed from its stored events.");
  }
  const undo: readonly (readonly SessionEvent[])[] = Array.isArray(undoStack)
    ? undoStack.filter(isEventArray)
    : [];
  return { base: migratedBase, events, table: replayed.table, undoStack: undo };
}

// Reconstruct a true legacy session ({ table, undoStack: TableState[] }, no
// base/events) into the event-sourced shape by diffing its snapshot trace.
function migrateLegacySession(table: unknown, undoStack: readonly unknown[]): SessionState {
  const snapshots = [...undoStack, table].map(migrateTable);
  if (!snapshots.every(isValidTable)) {
    throw new Error("The saved session has an unsupported format.");
  }
  return reconstructSessionFromSnapshots(snapshots).state;
}

export function parseStoredSession(serialized: string): SessionState {
  const input: unknown = JSON.parse(serialized);
  if (typeof input !== "object" || input === null) {
    throw new Error("The saved session has an unsupported format.");
  }

  // Event-sourced shape (stored v2 carries schemaVersion: 2; an unversioned
  // new-shape document is detected by the presence of base + events).
  if ("base" in input && "events" in input) {
    return adoptEventSourced(input.base, input.events, "undoStack" in input ? input.undoStack : []);
  }

  // True legacy shape: table + snapshot-array undoStack, no base/events.
  if ("table" in input && "undoStack" in input && Array.isArray(input.undoStack)) {
    return migrateLegacySession(input.table, input.undoStack);
  }

  throw new Error("The saved session has an unsupported format.");
}

const persistedUndoDepth = 50;

// Serialize to the stored v2 document. table is intentionally omitted (replay on
// load is the source of truth); the persisted undo stack is capped at the most
// recent entries to keep the document well inside storage limits, while the
// in-memory stack stays unbounded.
export function serializeStoredSession(state: SessionState): string {
  return JSON.stringify({
    base: state.base,
    events: state.events,
    schemaVersion: 2,
    undoStack: state.undoStack.slice(-persistedUndoDepth),
  });
}
