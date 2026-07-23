import type { Wind } from "@richii/score-core";

import type {
  DrawCommand,
  DrawRecord,
  RoundRecord,
  SessionState,
  TablePlayer,
  TableState,
  WinCommand,
  WinRecord,
} from "../domain/session";

const initialScore = 25_000;
const winds: readonly Wind[] = ["east", "south", "west", "north"];

function assertPlayerIndex(table: TableState, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= table.players.length) {
    throw new RangeError(`Player index ${index} is outside this table.`);
  }
}

function withUndo(state: SessionState, table: TableState): SessionState {
  return { table, undoStack: [...state.undoStack, state.table] };
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

  return {
    table: {
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
    },
    undoStack: [],
  };
}

export function declareRiichi(state: SessionState, playerIndex: number): SessionState {
  const { table } = state;
  assertPlayerIndex(table, playerIndex);
  if (table.declaredRiichiPlayerIndices.includes(playerIndex)) {
    return state;
  }
  const player = table.players[playerIndex];
  if (player === undefined || player.score < 1000) {
    throw new Error("A player needs at least 1,000 points to declare riichi.");
  }

  const deltas = table.players.map((_, index) => (index === playerIndex ? -1000 : 0));
  return withUndo(state, {
    ...table,
    declaredRiichiPlayerIndices: [...table.declaredRiichiPlayerIndices, playerIndex],
    players: updateScores(table, deltas),
    riichiSticks: table.riichiSticks + 1,
  });
}

export function applyWin(state: SessionState, command: WinCommand): SessionState {
  const { table } = state;
  assertPlayerIndex(table, command.winnerIndex);
  const deltas = table.players.map(() => 0);

  if (command.payments.kind === "ron") {
    if (command.discarderIndex === null || command.discarderIndex === command.winnerIndex) {
      throw new Error("A ron result needs a different discarding player.");
    }
    assertPlayerIndex(table, command.discarderIndex);
    deltas[command.winnerIndex] = command.payments.fromDiscarder;
    deltas[command.discarderIndex] = -command.payments.fromDiscarder;
  } else {
    if (command.discarderIndex !== null) {
      throw new Error("A tsumo result cannot have a discarding player.");
    }
    for (let index = 0; index < table.players.length; index += 1) {
      if (index === command.winnerIndex) {
        continue;
      }
      const payment =
        command.payments.fromDealer !== null && index === table.dealerIndex
          ? command.payments.fromDealer
          : command.payments.fromEachNonDealer;
      deltas[index] = -payment;
      deltas[command.winnerIndex] = (deltas[command.winnerIndex] ?? 0) + payment;
    }
  }

  deltas[command.winnerIndex] = (deltas[command.winnerIndex] ?? 0) + table.riichiSticks * 1000;
  const record: WinRecord = {
    deltas,
    discarderIndex: command.discarderIndex,
    handNumber: table.handNumber,
    honba: table.honba,
    id: command.id,
    kind: "win",
    occurredAt: command.occurredAt,
    payments: command.payments,
    roundWind: table.roundWind,
    winnerIndex: command.winnerIndex,
  };
  const dealerRepeats = command.winnerIndex === table.dealerIndex;

  return withUndo(state, {
    ...table,
    ...advanceHand(table, dealerRepeats),
    declaredRiichiPlayerIndices: [],
    history: appendRecord(table, record),
    honba: dealerRepeats ? table.honba + 1 : 0,
    players: updateScores(table, deltas),
    riichiSticks: 0,
  });
}

export function applyDraw(state: SessionState, command: DrawCommand): SessionState {
  const { table } = state;
  const tenpai = [...new Set(command.tenpaiPlayerIndices)].toSorted((left, right) => left - right);
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
    id: command.id,
    kind: "draw",
    occurredAt: command.occurredAt,
    roundWind: table.roundWind,
    tenpaiPlayerIndices: tenpai,
  };
  const dealerRepeats = tenpai.includes(table.dealerIndex);

  return withUndo(state, {
    ...table,
    ...advanceHand(table, dealerRepeats),
    declaredRiichiPlayerIndices: [],
    history: appendRecord(table, record),
    honba: table.honba + 1,
    players: updateScores(table, deltas),
  });
}

export function undoLastSessionChange(state: SessionState): SessionState {
  const previous = state.undoStack.at(-1);
  if (previous === undefined) {
    return state;
  }
  return { table: previous, undoStack: state.undoStack.slice(0, -1) };
}
