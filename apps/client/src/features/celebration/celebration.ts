import type { ScoreHandResult } from "@riichimi/score-core";

export interface Celebration {
  /** 1 (mangan) … 6 (yakuman) … 9 (quadruple). Drives every other number here. */
  readonly tier: number;
  /** The limit name, for reference; the panel already shows it as the title. */
  readonly limit: string;
  /** The word the brush stamps, in kanji. */
  readonly term: string;
  /** Baiman and above crackle with lightning as well as fire. */
  readonly lightning: boolean;
  readonly durationMs: number;
  /**
   * When the last character lands — the moment the word is complete, and the
   * one the flash, the hardest ring and the deepest bell are all timed to.
   */
  readonly climaxAtMs: number;
  /** The silence between one character landing and the next. */
  readonly gapMs: number;
  /** Type size for one character, as a CSS length that also has to fit. */
  readonly fontSize: string;
}

/**
 * The scale, low to high. Multi-yakuman continues it rather than sharing a rung
 * with a single one: a hand worth four yakuman should not look like a hand worth
 * one, and it used to, because both stopped at the top of the table.
 */
const TIER: Readonly<Record<string, number>> = {
  mangan: 1,
  haneman: 2,
  baiman: 3,
  sanbaiman: 4,
  yonbaiman: 5,
  yakuman: 6,
  "double yakuman": 7,
  "triple yakuman": 8,
  "quadruple yakuman": 9,
};

/**
 * The limit written the way the brush would write it. Spoken, these are
 * ダブル役満 and so on; stamped, the kanji forms read as one seal rather than as
 * a loanword, and they were missing above double — a triple yakuman stamped the
 * same 役満 as a single one.
 */
const TERMS: Readonly<Record<string, string>> = {
  mangan: "満貫",
  haneman: "跳満",
  baiman: "倍満",
  sanbaiman: "三倍満",
  yonbaiman: "数え役満",
  yakuman: "役満",
  "double yakuman": "二倍役満",
  "triple yakuman": "三倍役満",
  "quadruple yakuman": "四倍役満",
};

/** Ignition: the fire arrives before the first character does. */
const IGNITION_MS = 140;

/** The fade that uncovers the score underneath. */
const FADE_MS = 520;

/**
 * How long a character waits for the next one.
 *
 * From the tier, never from how many characters there are. Deriving it from the
 * count meant the longest words — which are the biggest hands — were the most
 * hurried: 二倍役満 struck four times in the space 満貫 took for two.
 */
function gapFor(tier: number): number {
  return 170 + tier * 26;
}

/** How long the completed word is held before it fades. */
function holdFor(tier: number): number {
  return 500 + tier * 160;
}

/**
 * Type size, from the tier and nothing else — with a width that still has to
 * fit. `min()` keeps the fit in CSS, where the viewport is known without
 * measuring it and without a resize costing a render.
 */
function fontSizeFor(tier: number, characters: number): string {
  return `min(${String(4.2 + tier)}rem, ${String(Math.floor(92 / characters))}vw)`;
}

/**
 * How large a celebration a scored hand has earned — or null for an ordinary
 * hand. This reads the already-computed limit; it is presentation policy over a
 * domain result, never a scoring decision.
 */
export function celebrationFor(result: ScoreHandResult): Celebration | null {
  if (result.kind !== "success" || result.limit === null) {
    return null;
  }
  // An unlisted multiple ("5x yakuman") tops the scale rather than falling to
  // the bottom of it.
  const tier = TIER[result.limit] ?? 9;
  const term = TERMS[result.limit] ?? "役満";
  const gapMs = gapFor(tier);
  const climaxAtMs = IGNITION_MS + gapMs * (term.length - 1);

  return {
    climaxAtMs,
    durationMs: climaxAtMs + holdFor(tier) + FADE_MS,
    fontSize: fontSizeFor(tier, term.length),
    gapMs,
    lightning: tier >= 3,
    limit: result.limit,
    term,
    tier,
  };
}
