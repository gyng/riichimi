import type { Wind } from "@riichimi/score-core";

import type {
  DrawCommand,
  DrawEvent,
  DrawRecord,
  RiichiCommand,
  RiichiEvent,
  RoundRecord,
  SessionEvent,
  SessionState,
  TablePlayer,
  TableState,
  WinCommand,
  WinEvent,
  WinRecord,
} from "../domain/session";

const initialScore = 25_000;
const winds: readonly Wind[] = ["east", "south", "west", "north"];

function isPlayerIndexInRange(table: TableState, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < table.players.length;
}

function assertPlayerIndex(table: TableState, index: number): void {
  if (!isPlayerIndexInRange(table, index)) {
    throw new RangeError(`Player index ${index} is outside this table.`);
  }
}

function updateScores(table: TableState, deltas: readonly number[]): readonly TablePlayer[] {
  return table.players.map((player, index) => ({
    ...player,
    score: player.score + (deltas[index] ?? 0),
  }));
}

function advanceHand(
  table: TableState,
  dealerRepeats: boolean,
): Pick<TableState, "dealerIndex" | "handNumber" | "roundWind"> {
  if (dealerRepeats) {
    return {
      dealerIndex: table.dealerIndex,
      handNumber: table.handNumber,
      roundWind: table.roundWind,
    };
  }

  if (table.handNumber < 4) {
    return {
      dealerIndex: (table.dealerIndex + 1) % 4,
      handNumber: table.handNumber + 1,
      roundWind: table.roundWind,
    };
  }

  const windIndex = winds.indexOf(table.roundWind);
  return {
    dealerIndex: (table.dealerIndex + 1) % 4,
    handNumber: 1,
    roundWind: winds[(windIndex + 1) % winds.length] ?? "east",
  };
}

function appendRecord(table: TableState, record: RoundRecord): readonly RoundRecord[] {
  return [...table.history, record];
}

// Table-level appliers. Each is the verbatim math of the matching live reducer,
// returning the advanced TableState instead of a SessionState. They assume the
// event has already been validated (replay validates to typed failures first;
// the live reducers validate before building the event). The throwing helpers
// they retain are programmer-error guards, not the expected-outcome path.

function applyRiichiToTable(table: TableState, event: RiichiEvent): TableState {
  if (table.declaredRiichiPlayerIndices.includes(event.playerIndex)) {
    return table;
  }
  const deltas = table.players.map((_, index) => (index === event.playerIndex ? -1000 : 0));
  return {
    ...table,
    declaredRiichiPlayerIndices: [...table.declaredRiichiPlayerIndices, event.playerIndex],
    players: updateScores(table, deltas),
    riichiSticks: table.riichiSticks + 1,
  };
}

function applyWinToTable(table: TableState, event: WinEvent): TableState {
  assertPlayerIndex(table, event.winnerIndex);
  const deltas = table.players.map(() => 0);

  if (event.payments.kind === "ron") {
    if (event.discarderIndex === null || event.discarderIndex === event.winnerIndex) {
      throw new Error("A ron result needs a different discarding player.");
    }
    assertPlayerIndex(table, event.discarderIndex);
    deltas[event.winnerIndex] = event.payments.fromDiscarder;
    deltas[event.discarderIndex] = -event.payments.fromDiscarder;
  } else {
    if (event.discarderIndex !== null) {
      throw new Error("A tsumo result cannot have a discarding player.");
    }
    for (let index = 0; index < table.players.length; index += 1) {
      if (index === event.winnerIndex) {
        continue;
      }
      const payment =
        event.payments.fromDealer !== null && index === table.dealerIndex
          ? event.payments.fromDealer
          : event.payments.fromEachNonDealer;
      deltas[index] = -payment;
      deltas[event.winnerIndex] = (deltas[event.winnerIndex] ?? 0) + payment;
    }
  }

  deltas[event.winnerIndex] = (deltas[event.winnerIndex] ?? 0) + table.riichiSticks * 1000;
  const record: WinRecord = {
    deltas,
    discarderIndex: event.discarderIndex,
    handNumber: table.handNumber,
    honba: table.honba,
    id: event.id,
    kind: "win",
    occurredAt: event.occurredAt,
    payments: event.payments,
    roundWind: table.roundWind,
    winnerIndex: event.winnerIndex,
  };
  const dealerRepeats = event.winnerIndex === table.dealerIndex;

  return {
    ...table,
    ...advanceHand(table, dealerRepeats),
    declaredRiichiPlayerIndices: [],
    history: appendRecord(table, record),
    honba: dealerRepeats ? table.honba + 1 : 0,
    players: updateScores(table, deltas),
    riichiSticks: 0,
  };
}

function applyDrawToTable(table: TableState, event: DrawEvent): TableState {
  const tenpai = [...new Set(event.tenpaiPlayerIndices)].toSorted((left, right) => left - right);
  for (const index of tenpai) {
    assertPlayerIndex(table, index);
  }
  const deltas = table.players.map(() => 0);
  if (tenpai.length > 0 && tenpai.length < 4) {
    const notenCount = 4 - tenpai.length;
    const received = 3000 / tenpai.length;
    const paid = 3000 / notenCount;
    for (let index = 0; index < 4; index += 1) {
      deltas[index] = tenpai.includes(index) ? received : -paid;
    }
  }
  const record: DrawRecord = {
    deltas,
    handNumber: table.handNumber,
    honba: table.honba,
    id: event.id,
    kind: "draw",
    occurredAt: event.occurredAt,
    roundWind: table.roundWind,
    tenpaiPlayerIndices: tenpai,
  };
  const dealerRepeats = tenpai.includes(table.dealerIndex);

  return {
    ...table,
    ...advanceHand(table, dealerRepeats),
    declaredRiichiPlayerIndices: [],
    history: appendRecord(table, record),
    honba: table.honba + 1,
    players: updateScores(table, deltas),
  };
}

function applyEventToTable(table: TableState, event: SessionEvent): TableState {
  switch (event.kind) {
    case "draw":
      return applyDrawToTable(table, event);
    case "riichi":
      return applyRiichiToTable(table, event);
    case "win":
      return applyWinToTable(table, event);
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

export type ReplayFailure =
  | { readonly eventId: string; readonly kind: "invalid-event"; readonly reason: string }
  | { readonly eventId: string; readonly kind: "riichi-underfunded"; readonly playerIndex: number };

export type ReplayResult =
  | { readonly kind: "replayed"; readonly table: TableState }
  | ReplayFailure;

// Validate an event's shape against the table it would apply to. Stored and
// edited logs are untrusted, so shape violations become typed failures here,
// before the appliers run (their internal asserts then stay programmer guards).
function validateEvent(table: TableState, event: SessionEvent): ReplayFailure | null {
  switch (event.kind) {
    case "draw": {
      for (const index of event.tenpaiPlayerIndices) {
        if (!isPlayerIndexInRange(table, index)) {
          return {
            eventId: event.id,
            kind: "invalid-event",
            reason: `Tenpai player index ${index} is outside this table.`,
          };
        }
      }
      return null;
    }
    case "riichi": {
      if (!isPlayerIndexInRange(table, event.playerIndex)) {
        return {
          eventId: event.id,
          kind: "invalid-event",
          reason: `Player index ${event.playerIndex} is outside this table.`,
        };
      }
      // A repeat declaration is a valid no-op (parity with declareRiichi's early
      // return), and takes precedence over the affordability check.
      if (table.declaredRiichiPlayerIndices.includes(event.playerIndex)) {
        return null;
      }
      const player = table.players[event.playerIndex];
      if (player === undefined || player.score < 1000) {
        return { eventId: event.id, kind: "riichi-underfunded", playerIndex: event.playerIndex };
      }
      return null;
    }
    case "win": {
      if (!isPlayerIndexInRange(table, event.winnerIndex)) {
        return {
          eventId: event.id,
          kind: "invalid-event",
          reason: `Winner index ${event.winnerIndex} is outside this table.`,
        };
      }
      if (event.payments.kind === "ron") {
        if (event.discarderIndex === null || event.discarderIndex === event.winnerIndex) {
          return {
            eventId: event.id,
            kind: "invalid-event",
            reason: "A ron result needs a different discarding player.",
          };
        }
        if (!isPlayerIndexInRange(table, event.discarderIndex)) {
          return {
            eventId: event.id,
            kind: "invalid-event",
            reason: `Discarder index ${event.discarderIndex} is outside this table.`,
          };
        }
      } else if (event.discarderIndex !== null) {
        return {
          eventId: event.id,
          kind: "invalid-event",
          reason: "A tsumo result cannot have a discarding player.",
        };
      }
      return null;
    }
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

export function replaySessionEvents(
  base: TableState,
  events: readonly SessionEvent[],
): ReplayResult {
  let table = base;
  for (const event of events) {
    const failure = validateEvent(table, event);
    if (failure !== null) {
      return failure;
    }
    table = applyEventToTable(table, event);
  }
  return { kind: "replayed", table };
}

// Append an already-validated event. table advances incrementally via
// applyEventToTable (no O(n) replay on the live-play hot path); the previous
// events array is pushed to undoStack so undo can pop + replay it.
function pushEvent(state: SessionState, event: SessionEvent): SessionState {
  return {
    base: state.base,
    events: [...state.events, event],
    table: applyEventToTable(state.table, event),
    undoStack: [...state.undoStack, state.events],
  };
}

export function createSession(input: {
  readonly id: string;
  readonly playerNames: readonly string[];
  readonly rulesProfileId: string;
  readonly startedAt: string;
}): SessionState {
  if (input.playerNames.length !== 4) {
    throw new RangeError("A riichi table requires exactly four players.");
  }
  if (input.playerNames.some((name) => name.trim().length === 0)) {
    throw new Error("Every player needs a name.");
  }
  if (input.rulesProfileId.trim().length === 0) {
    throw new Error("A table needs a scoring rules profile.");
  }

  const table: TableState = {
    dealerIndex: 0,
    declaredRiichiPlayerIndices: [],
    handNumber: 1,
    history: [],
    honba: 0,
    id: input.id,
    players: input.playerNames.map((name, index) => ({
      id: `${input.id}-player-${index + 1}`,
      name: name.trim(),
      score: initialScore,
    })),
    riichiSticks: 0,
    roundWind: "east",
    rulesProfileId: input.rulesProfileId,
    startedAt: input.startedAt,
  };

  return {
    base: table,
    events: [],
    table,
    undoStack: [],
  };
}

export function declareRiichi(state: SessionState, command: RiichiCommand): SessionState {
  const { table } = state;
  assertPlayerIndex(table, command.playerIndex);
  if (table.declaredRiichiPlayerIndices.includes(command.playerIndex)) {
    return state;
  }
  const player = table.players[command.playerIndex];
  if (player === undefined || player.score < 1000) {
    throw new Error("A player needs at least 1,000 points to declare riichi.");
  }

  return pushEvent(state, {
    id: command.id,
    kind: "riichi",
    occurredAt: command.occurredAt,
    playerIndex: command.playerIndex,
  });
}

export function applyWin(state: SessionState, command: WinCommand): SessionState {
  return pushEvent(state, {
    discarderIndex: command.discarderIndex,
    id: command.id,
    kind: "win",
    occurredAt: command.occurredAt,
    payments: command.payments,
    winnerIndex: command.winnerIndex,
  });
}

export function applyDraw(state: SessionState, command: DrawCommand): SessionState {
  return pushEvent(state, {
    id: command.id,
    kind: "draw",
    occurredAt: command.occurredAt,
    tenpaiPlayerIndices: command.tenpaiPlayerIndices,
  });
}

export function undoLastSessionChange(state: SessionState): SessionState {
  const previousEvents = state.undoStack.at(-1);
  if (previousEvents === undefined) {
    return state;
  }
  const replayed = replaySessionEvents(state.base, previousEvents);
  if (replayed.kind !== "replayed") {
    // The popped log was current before this action, so it already replayed
    // cleanly. Reaching here means the invariant was broken elsewhere.
    throw new Error("Undo could not replay a previously valid session log.");
  }
  return {
    base: state.base,
    events: previousEvents,
    table: replayed.table,
    undoStack: state.undoStack.slice(0, -1),
  };
}
