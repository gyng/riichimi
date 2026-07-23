import type { RiichiEvent, SessionEvent, SessionState, TableState } from "../domain/session";
import { replaySessionEvents } from "./session";

export type SessionReconstruction =
  | { readonly kind: "reconstructed"; readonly state: SessionState }
  /** Trace could not be verified; session is preserved as a baseline snapshot.
      Scores/history intact; pre-existing rounds are not editable. */
  | { readonly kind: "restored-baseline"; readonly state: SessionState };

// Structural equality for JSON-shaped values. Stored snapshots come from
// JSON.parse (key order = serialization order) while replayed tables are built
// via object spread, so a stringify comparison would be order-fragile. Replay
// only ever produces primitives, arrays, and plain objects, matching the parsed
// snapshot, so a recursive compare is both sufficient and precise.
function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((value, index) => deepEqual(value, right[index]));
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(right, key) &&
      deepEqual(Reflect.get(left, key), Reflect.get(right, key)),
  );
}

// The occurredAt of the first round that completes at or after `fromIndex`.
// A migrated riichi has no recorded timestamp of its own, so it borrows the
// timestamp of the round it precedes (display-only approximation).
function nextRoundOccurredAt(snapshots: readonly TableState[], fromIndex: number): string | null {
  for (let index = fromIndex; index + 1 < snapshots.length; index += 1) {
    const current = snapshots[index];
    const next = snapshots[index + 1];
    if (current === undefined || next === undefined) {
      return null;
    }
    if (next.history.length > current.history.length) {
      return next.history.at(-1)?.occurredAt ?? null;
    }
  }
  return null;
}

function eventFromHistoryGrowth(next: TableState): SessionEvent | null {
  const record = next.history.at(-1);
  if (record === undefined) {
    return null;
  }
  if (record.kind === "win") {
    return {
      discarderIndex: record.discarderIndex,
      id: record.id,
      kind: "win",
      occurredAt: record.occurredAt,
      payments: record.payments,
      winnerIndex: record.winnerIndex,
    };
  }
  return {
    id: record.id,
    kind: "draw",
    occurredAt: record.occurredAt,
    tenpaiPlayerIndices: record.tenpaiPlayerIndices,
  };
}

function addedRiichiIndex(previous: TableState, next: TableState): number | null {
  const before = new Set(previous.declaredRiichiPlayerIndices);
  const added = next.declaredRiichiPlayerIndices.filter((index) => !before.has(index));
  return added.length === 1 && added[0] !== undefined ? added[0] : null;
}

function restoredBaseline(base: TableState): SessionReconstruction {
  return {
    kind: "restored-baseline",
    state: { base, events: [], table: base, undoStack: [] },
  };
}

/**
 * Reconstruct an event-sourced session from a legacy chronological snapshot
 * trace (`[...v1.undoStack, v1.table]`). Each consecutive pair encodes exactly
 * one action, classified by diffing. The result is verified by replay equality
 * against the final snapshot; an unverifiable trace degrades to a lossless
 * read-only baseline rather than risk silently altered scores.
 */
export function reconstructSessionFromSnapshots(
  snapshots: readonly TableState[],
): SessionReconstruction {
  const base = snapshots[0];
  if (base === undefined) {
    throw new Error("Cannot reconstruct a session from an empty snapshot trace.");
  }
  const last = snapshots.at(-1);
  if (last === undefined) {
    throw new Error("Cannot reconstruct a session from an empty snapshot trace.");
  }

  const events: SessionEvent[] = [];
  let migratedRiichiCount = 0;

  for (let index = 0; index + 1 < snapshots.length; index += 1) {
    const previous = snapshots[index];
    const next = snapshots[index + 1];
    if (previous === undefined || next === undefined) {
      return restoredBaseline(last);
    }

    if (next.history.length === previous.history.length + 1) {
      const event = eventFromHistoryGrowth(next);
      if (event === null) {
        return restoredBaseline(last);
      }
      events.push(event);
      continue;
    }

    const riichiIndex = addedRiichiIndex(previous, next);
    if (riichiIndex !== null && next.history.length === previous.history.length) {
      const event: RiichiEvent = {
        id: `riichi-migrated-${migratedRiichiCount}`,
        kind: "riichi",
        occurredAt: nextRoundOccurredAt(snapshots, index + 1) ?? base.startedAt,
        playerIndex: riichiIndex,
      };
      migratedRiichiCount += 1;
      events.push(event);
      continue;
    }

    return restoredBaseline(last);
  }

  const replayed = replaySessionEvents(base, events);
  if (replayed.kind !== "replayed" || !deepEqual(replayed.table, last)) {
    return restoredBaseline(last);
  }

  // Mirror the undo stack live play would have produced: one entry per event,
  // each the log state immediately before that event was appended.
  const undoStack = events.map((_, index) => events.slice(0, index));
  return {
    kind: "reconstructed",
    state: { base, events, table: replayed.table, undoStack },
  };
}
