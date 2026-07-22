import type { DeclaredMeld } from "./meld";
import type { ScoringRules } from "./rules";
import type { TileId, Wind } from "./tile";

export type WinMethod = "ron" | "tsumo";
export type RiichiStatus = "none" | "riichi" | "double-riichi";
export type FirstTurnWin = "none" | "tenhou" | "chiihou" | "renhou";
export type LastTileWin = "none" | "haitei" | "houtei";

export interface WinContext {
  readonly chankan: boolean;
  readonly firstTurn: FirstTurnWin;
  readonly honba: number;
  readonly ippatsu: boolean;
  readonly lastTile: LastTileWin;
  readonly method: WinMethod;
  readonly riichi: RiichiStatus;
  readonly riichiSticks: number;
  readonly rinshan: boolean;
  readonly roundWind: Wind;
  readonly seatWind: Wind;
}

export interface ScoreHandInput {
  readonly concealedTiles: readonly TileId[];
  readonly context: WinContext;
  readonly doraIndicators: readonly TileId[];
  readonly melds: readonly DeclaredMeld[];
  readonly rules: ScoringRules;
  readonly uraDoraIndicators: readonly TileId[];
  readonly winningTile: TileId;
}

export type HandValidationIssueCode =
  | "HAND_SIZE"
  | "IMPOSSIBLE_TILE_COUNT"
  | "INVALID_MELD"
  | "INVALID_CONTEXT"
  | "RED_FIVE_NOT_ALLOWED"
  | "TOO_MANY_MELDS"
  | "WINNING_TILE_MISSING";

export interface HandValidationIssue {
  readonly code: HandValidationIssueCode;
  readonly message: string;
}
