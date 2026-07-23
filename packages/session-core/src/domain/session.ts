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
  readonly rulesProfileId: string;
  readonly startedAt: string;
}

export interface RiichiEvent {
  readonly id: string;
  readonly kind: "riichi";
  readonly occurredAt: string;
  readonly playerIndex: number;
}

export interface WinEvent {
  readonly discarderIndex: number | null;
  readonly id: string;
  readonly kind: "win";
  readonly occurredAt: string;
  readonly payments: PaymentBreakdown;
  readonly winnerIndex: number;
}

export interface DrawEvent {
  readonly id: string;
  readonly kind: "draw";
  readonly occurredAt: string;
  readonly tenpaiPlayerIndices: readonly number[];
}

export type SessionEvent = DrawEvent | RiichiEvent | WinEvent;

export interface SessionState {
  /** Immutable starting snapshot. Replay always folds events over this base. */
  readonly base: TableState;
  readonly events: readonly SessionEvent[];
  /** Derived cache; invariant: deep-equals replaySessionEvents(base, events). */
  readonly table: TableState;
  /** Prior event logs, most recent last. Undo = pop + replay. */
  readonly undoStack: readonly (readonly SessionEvent[])[];
}

export interface RiichiCommand {
  readonly id: string;
  readonly occurredAt: string;
  readonly playerIndex: number;
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
