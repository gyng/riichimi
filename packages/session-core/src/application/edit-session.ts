import type { PaymentBreakdown, Wind } from "@richii/score-core";

import type {
  RiichiEvent,
  RoundRecord,
  SessionEvent,
  SessionState,
  TableState,
} from "../domain/session";
import { replaySessionEvents } from "./session";

export type RoundRevision =
  | {
      readonly discarderIndex: number | null;
      readonly kind: "win";
      readonly payments: PaymentBreakdown;
      readonly winnerIndex: number;
    }
  | { readonly kind: "draw"; readonly tenpaiPlayerIndices: readonly number[] };

export type SessionEditCommand =
  | { readonly kind: "delete-round"; readonly roundId: string }
  | { readonly kind: "replace-round"; readonly revision: RoundRevision; readonly roundId: string }
  /** Rewrite the riichi declarations of a completed round's hand, or of the
      current in-progress hand when roundId is null. */
  | {
      readonly declarations: readonly {
        readonly id: string;
        readonly occurredAt: string;
        readonly playerIndex: number;
      }[];
      readonly kind: "set-hand-riichi";
      readonly roundId: string | null;
    };

export type SessionEditError =
  | { readonly kind: "invalid-revision"; readonly reason: string }
  | { readonly kind: "round-not-editable"; readonly roundId: string }
  | { readonly kind: "round-not-found"; readonly roundId: string }
  | { readonly eventId: string; readonly kind: "riichi-underfunded"; readonly playerIndex: number };

interface RoundContext {
  readonly deltas: readonly number[];
  readonly handNumber: number;
  readonly honba: number;
  readonly roundWind: Wind;
}

export interface RoundContextChange {
  readonly after: RoundContext;
  readonly before: RoundContext;
  readonly roundId: string;
}

export type EditWarning =
  /** A later win's replayed honba differs from before; its entered payment
      embeds the old honba bonus and needs human review. */
  | {
      readonly afterHonba: number;
      readonly beforeHonba: number;
      readonly kind: "stale-honba-payment";
      readonly roundId: string;
    }
  /** A later tsumo's winner-is-dealer status flipped; its dealer/non-dealer
      payment split was computed for the old seating. */
  | { readonly kind: "stale-dealer-payment"; readonly roundId: string };

export interface EditReview {
  readonly changedRounds: readonly RoundContextChange[];
  /** Per seat, final score after the edit minus final score before. */
  readonly scoreChanges: readonly number[];
  readonly warnings: readonly EditWarning[];
}

export type SessionEditResult =
  | { readonly kind: "edited"; readonly review: EditReview; readonly state: SessionState }
  | { readonly error: SessionEditError; readonly kind: "rejected" };

function isIndexInRange(index: number, playerCount: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < playerCount;
}

// Index of the win/draw event carrying `roundId`, or -1. Riichi events are not
// rounds, so their ids never match here.
function findRoundEventIndex(events: readonly SessionEvent[], roundId: string): number {
  return events.findIndex(
    (event) => event.id === roundId && (event.kind === "win" || event.kind === "draw"),
  );
}

// The hand segment of the round at `roundIndex`: riichi event indices strictly
// between the previous win/draw event and the round itself. All non-round events
// in that span are riichi, but the kind check keeps the rule explicit.
function segmentRiichiIndices(events: readonly SessionEvent[], roundIndex: number): number[] {
  let previousRound = -1;
  for (let index = roundIndex - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event !== undefined && (event.kind === "win" || event.kind === "draw")) {
      previousRound = index;
      break;
    }
  }
  const indices: number[] = [];
  for (let index = previousRound + 1; index < roundIndex; index += 1) {
    if (events[index]?.kind === "riichi") {
      indices.push(index);
    }
  }
  return indices;
}

// Riichi events belonging to the current, in-progress hand: those after the last
// win/draw event in the log.
function currentHandRiichiIndices(events: readonly SessionEvent[]): number[] {
  let lastRound = -1;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event !== undefined && (event.kind === "win" || event.kind === "draw")) {
      lastRound = index;
      break;
    }
  }
  const indices: number[] = [];
  for (let index = lastRound + 1; index < events.length; index += 1) {
    if (events[index]?.kind === "riichi") {
      indices.push(index);
    }
  }
  return indices;
}

function validateRevision(revision: RoundRevision, playerCount: number): SessionEditError | null {
  if (revision.kind === "draw") {
    for (const index of revision.tenpaiPlayerIndices) {
      if (!isIndexInRange(index, playerCount)) {
        return {
          kind: "invalid-revision",
          reason: `Tenpai player index ${index} is outside this table.`,
        };
      }
    }
    return null;
  }
  if (!isIndexInRange(revision.winnerIndex, playerCount)) {
    return {
      kind: "invalid-revision",
      reason: `Winner index ${revision.winnerIndex} is outside this table.`,
    };
  }
  if (revision.payments.kind === "ron") {
    if (revision.discarderIndex === null || revision.discarderIndex === revision.winnerIndex) {
      return {
        kind: "invalid-revision",
        reason: "A ron result needs a different discarding player.",
      };
    }
    if (!isIndexInRange(revision.discarderIndex, playerCount)) {
      return {
        kind: "invalid-revision",
        reason: `Discarder index ${revision.discarderIndex} is outside this table.`,
      };
    }
    return null;
  }
  if (revision.discarderIndex !== null) {
    return { kind: "invalid-revision", reason: "A tsumo result cannot have a discarding player." };
  }
  return null;
}

function validateDeclarations(
  declarations: readonly { readonly playerIndex: number }[],
  playerCount: number,
): SessionEditError | null {
  const seen = new Set<number>();
  for (const declaration of declarations) {
    if (!isIndexInRange(declaration.playerIndex, playerCount)) {
      return {
        kind: "invalid-revision",
        reason: `Player index ${declaration.playerIndex} is outside this table.`,
      };
    }
    if (seen.has(declaration.playerIndex)) {
      return {
        kind: "invalid-revision",
        reason: `Player index ${declaration.playerIndex} declares riichi more than once in one hand.`,
      };
    }
    seen.add(declaration.playerIndex);
  }
  return null;
}

function eventFromRevision(revision: RoundRevision, id: string, occurredAt: string): SessionEvent {
  if (revision.kind === "win") {
    return {
      discarderIndex: revision.discarderIndex,
      id,
      kind: "win",
      occurredAt,
      payments: revision.payments,
      winnerIndex: revision.winnerIndex,
    };
  }
  return {
    id,
    kind: "draw",
    occurredAt,
    tenpaiPlayerIndices: revision.tenpaiPlayerIndices,
  };
}

type LocateResult =
  | { readonly index: number; readonly kind: "located" }
  | { readonly error: SessionEditError; readonly kind: "error" };

function locateRound(state: SessionState, roundId: string): LocateResult {
  const index = findRoundEventIndex(state.events, roundId);
  if (index !== -1) {
    return { index, kind: "located" };
  }
  const inBaseline = state.table.history.some((record) => record.id === roundId);
  return {
    error: inBaseline
      ? { kind: "round-not-editable", roundId }
      : { kind: "round-not-found", roundId },
    kind: "error",
  };
}

type CandidateResult =
  | { readonly events: readonly SessionEvent[]; readonly kind: "candidate" }
  | { readonly error: SessionEditError; readonly kind: "error" };

function buildCandidate(state: SessionState, command: SessionEditCommand): CandidateResult {
  const { events } = state;
  const playerCount = state.base.players.length;

  switch (command.kind) {
    case "delete-round": {
      const located = locateRound(state, command.roundId);
      if (located.kind === "error") {
        return located;
      }
      const removed = new Set([located.index, ...segmentRiichiIndices(events, located.index)]);
      return { events: events.filter((_, index) => !removed.has(index)), kind: "candidate" };
    }
    case "replace-round": {
      const located = locateRound(state, command.roundId);
      if (located.kind === "error") {
        return located;
      }
      const revisionError = validateRevision(command.revision, playerCount);
      if (revisionError !== null) {
        return { error: revisionError, kind: "error" };
      }
      const original = events[located.index];
      if (original === undefined) {
        return { error: { kind: "round-not-found", roundId: command.roundId }, kind: "error" };
      }
      const replacement = eventFromRevision(command.revision, original.id, original.occurredAt);
      return {
        events: events.map((event, index) => (index === located.index ? replacement : event)),
        kind: "candidate",
      };
    }
    case "set-hand-riichi": {
      const declarationError = validateDeclarations(command.declarations, playerCount);
      if (declarationError !== null) {
        return { error: declarationError, kind: "error" };
      }
      const newRiichi: readonly RiichiEvent[] = command.declarations.map((declaration) => ({
        id: declaration.id,
        kind: "riichi",
        occurredAt: declaration.occurredAt,
        playerIndex: declaration.playerIndex,
      }));

      if (command.roundId === null) {
        const removed = new Set(currentHandRiichiIndices(events));
        const kept = events.filter((_, index) => !removed.has(index));
        return { events: [...kept, ...newRiichi], kind: "candidate" };
      }

      const located = locateRound(state, command.roundId);
      if (located.kind === "error") {
        return located;
      }
      const removed = new Set(segmentRiichiIndices(events, located.index));
      const candidate: SessionEvent[] = [];
      for (let index = 0; index < events.length; index += 1) {
        if (index === located.index) {
          candidate.push(...newRiichi);
        }
        if (removed.has(index)) {
          continue;
        }
        const event = events[index];
        if (event !== undefined) {
          candidate.push(event);
        }
      }
      return { events: candidate, kind: "candidate" };
    }
    default: {
      const exhaustive: never = command;
      return exhaustive;
    }
  }
}

function indexHistoryById(history: readonly RoundRecord[]): Map<string, RoundRecord> {
  const byId = new Map<string, RoundRecord>();
  for (const record of history) {
    byId.set(record.id, record);
  }
  return byId;
}

// Table context immediately before each win/draw event, keyed by its id. Used to
// resolve the dealer seat at a round (not stored on the record). The log is known
// valid here, so replay never fails.
function dealerIndexByRound(
  base: TableState,
  events: readonly SessionEvent[],
): Map<string, number> {
  const byId = new Map<string, number>();
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event === undefined || (event.kind !== "win" && event.kind !== "draw")) {
      continue;
    }
    const before = replaySessionEvents(base, events.slice(0, index));
    if (before.kind === "replayed") {
      byId.set(event.id, before.table.dealerIndex);
    }
  }
  return byId;
}

function contextChanged(before: RoundRecord, after: RoundRecord): boolean {
  return (
    before.handNumber !== after.handNumber ||
    before.honba !== after.honba ||
    before.roundWind !== after.roundWind ||
    before.deltas.length !== after.deltas.length ||
    before.deltas.some((delta, index) => delta !== after.deltas[index])
  );
}

function roundContext(record: RoundRecord): RoundContext {
  return {
    deltas: record.deltas,
    handNumber: record.handNumber,
    honba: record.honba,
    roundWind: record.roundWind,
  };
}

function computeReview(
  state: SessionState,
  candidate: readonly SessionEvent[],
  before: TableState,
  after: TableState,
): EditReview {
  const afterById = indexHistoryById(after.history);
  const changedRounds: RoundContextChange[] = [];
  const warnings: EditWarning[] = [];
  const beforeDealers = dealerIndexByRound(state.base, state.events);
  const afterDealers = dealerIndexByRound(state.base, candidate);

  for (const beforeRecord of before.history) {
    const afterRecord = afterById.get(beforeRecord.id);
    if (afterRecord === undefined) {
      continue;
    }
    if (contextChanged(beforeRecord, afterRecord)) {
      changedRounds.push({
        after: roundContext(afterRecord),
        before: roundContext(beforeRecord),
        roundId: beforeRecord.id,
      });
    }
    if (beforeRecord.kind !== "win" || afterRecord.kind !== "win") {
      continue;
    }
    if (beforeRecord.honba !== afterRecord.honba) {
      warnings.push({
        afterHonba: afterRecord.honba,
        beforeHonba: beforeRecord.honba,
        kind: "stale-honba-payment",
        roundId: beforeRecord.id,
      });
    }
    if (beforeRecord.payments.kind === "tsumo" && afterRecord.payments.kind === "tsumo") {
      const beforeDealer = beforeDealers.get(beforeRecord.id);
      const afterDealer = afterDealers.get(afterRecord.id);
      if (beforeDealer !== undefined && afterDealer !== undefined) {
        const wasDealerWin = beforeRecord.winnerIndex === beforeDealer;
        const isDealerWin = afterRecord.winnerIndex === afterDealer;
        if (wasDealerWin !== isDealerWin) {
          warnings.push({ kind: "stale-dealer-payment", roundId: beforeRecord.id });
        }
      }
    }
  }

  const scoreChanges = after.players.map(
    (player, index) => player.score - (before.players[index]?.score ?? 0),
  );

  return { changedRounds, scoreChanges, warnings };
}

// Shared pure core: preview and commit differ only in that the caller adopts the
// returned state (edit) or discards it after reading review (preview).
function applyEdit(state: SessionState, command: SessionEditCommand): SessionEditResult {
  const built = buildCandidate(state, command);
  if (built.kind === "error") {
    return { error: built.error, kind: "rejected" };
  }

  const replayed = replaySessionEvents(state.base, built.events);
  if (replayed.kind === "riichi-underfunded") {
    return {
      error: {
        eventId: replayed.eventId,
        kind: "riichi-underfunded",
        playerIndex: replayed.playerIndex,
      },
      kind: "rejected",
    };
  }
  if (replayed.kind !== "replayed") {
    // Shape violations are caught by the static validation above; a surviving
    // invalid-event means an unusual candidate, surfaced as a revision problem
    // rather than an untyped throw.
    return { error: { kind: "invalid-revision", reason: replayed.reason }, kind: "rejected" };
  }

  const review = computeReview(state, built.events, state.table, replayed.table);
  return {
    kind: "edited",
    review,
    state: {
      base: state.base,
      events: built.events,
      table: replayed.table,
      undoStack: [...state.undoStack, state.events],
    },
  };
}

export function editSessionRound(
  state: SessionState,
  command: SessionEditCommand,
): SessionEditResult {
  return applyEdit(state, command);
}

export function previewSessionEdit(
  state: SessionState,
  command: SessionEditCommand,
): SessionEditResult {
  return applyEdit(state, command);
}

export function editableRoundIds(state: SessionState): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const event of state.events) {
    if (event.kind === "win" || event.kind === "draw") {
      ids.add(event.id);
    }
  }
  return ids;
}

export function tableBeforeRound(state: SessionState, roundId: string): TableState | null {
  const index = findRoundEventIndex(state.events, roundId);
  if (index === -1) {
    return null;
  }
  const replayed = replaySessionEvents(state.base, state.events.slice(0, index));
  return replayed.kind === "replayed" ? replayed.table : null;
}
