import type { PaymentBreakdown, Wind } from "@richii/score-core";

export interface TablePlayer {
  readonly id: string;
  readonly name: string;
  readonly score: number;
}

export interface WinRecord {
  readonly deltas: readonly number[];
  readonly discarderIndex: number | null;
  readonly handNumber: number;
  readonly honba: number;
  readonly id: string;
  readonly kind: "win";
  readonly occurredAt: string;
  readonly payments: PaymentBreakdown;
  readonly roundWind: Wind;
  readonly winnerIndex: number;
}

export interface DrawRecord {
  readonly deltas: readonly number[];
  readonly handNumber: number;
  readonly honba: number;
  readonly id: string;
  readonly kind: "draw";
  readonly occurredAt: string;
  readonly roundWind: Wind;
  readonly tenpaiPlayerIndices: readonly number[];
}

export type RoundRecord = WinRecord | DrawRecord;

export interface TableState {
  readonly dealerIndex: number;
  readonly declaredRiichiPlayerIndices: readonly number[];
  readonly handNumber: number;
  readonly history: readonly RoundRecord[];
  readonly honba: number;
  readonly id: string;
  readonly players: readonly TablePlayer[];
  readonly riichiSticks: number;
  readonly roundWind: Wind;
  readonly startedAt: string;
}

export interface SessionState {
  readonly table: TableState;
  readonly undoStack: readonly TableState[];
}

export interface WinCommand {
  readonly discarderIndex: number | null;
  readonly id: string;
  readonly occurredAt: string;
  readonly payments: PaymentBreakdown;
  readonly winnerIndex: number;
}

export interface DrawCommand {
  readonly id: string;
  readonly occurredAt: string;
  readonly tenpaiPlayerIndices: readonly number[];
}
