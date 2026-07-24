import type { ScoreHandResult } from "@riichimi/score-core";

export interface Celebration {
  /** 1 (mangan) … 6 (yakuman) … 7 (multi-yakuman). Drives the effect intensity. */
  readonly tier: number;
  /** The limit name, for reference; the panel already shows it as the title. */
  readonly limit: string;
  /** Baiman and above crackle with lightning as well as fire. */
  readonly lightning: boolean;
  readonly durationMs: number;
}

const SINGLE_TIER: Readonly<Record<string, number>> = {
  mangan: 1,
  haneman: 2,
  baiman: 3,
  sanbaiman: 4,
  yonbaiman: 5,
  yakuman: 6,
};

/**
 * How large a celebration a scored hand has earned — or null for an ordinary
 * hand. This reads the already-computed limit; it is presentation policy over a
 * domain result, never a scoring decision.
 */
export function celebrationFor(result: ScoreHandResult): Celebration | null {
  if (result.kind !== "success" || result.limit === null) {
    return null;
  }
  // Any multi-yakuman ("double yakuman", "3x yakuman", …) tops the scale.
  const tier = SINGLE_TIER[result.limit] ?? 7;
  return {
    tier,
    limit: result.limit,
    lightning: tier >= 3,
    durationMs: 1200 + tier * 250,
  };
}
