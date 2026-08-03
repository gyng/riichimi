import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { CelebrationBanner } from "./celebration-banner";
import { celebrationFor } from "./celebration";
import type { LimitName, ScoreHandResult } from "@riichimi/score-core";

const atLimit = (limit: LimitName): ScoreHandResult => ({
  basePoints: 8000,
  dora: { dora: 0, redDora: 0, total: 0, uraDora: 0 },
  fu: null,
  han: null,
  kind: "success",
  limit,
  payments: { fromDiscarder: 8000, kind: "ron", total: 8000 },
  riichiBonus: 0,
  totalGain: 8000,
  yaku: [],
  yakuman: [],
});

function stamp(limit: LimitName) {
  const celebration = celebrationFor(atLimit(limit));
  if (celebration === null) {
    throw new Error(`${limit} earned no celebration.`);
  }
  return celebration;
}

describe("CelebrationBanner", () => {
  it("stamps the limit in kanji, one character each, hidden from assistive tech", () => {
    render(<CelebrationBanner celebration={stamp("yakuman")} />);

    // 役満 is rendered a character at a time so each can reveal on its own.
    // The banner is hidden from assistive tech, so include hidden elements.
    expect(screen.getAllByText("役").length).toBeGreaterThan(0);
    expect(screen.getAllByText("満").length).toBeGreaterThan(0);
  });

  it("gives a multi-yakuman its own stamp instead of a single one's", () => {
    // 三倍役満 used to render as plain 役満: the rarest hand in the game looked
    // exactly like a hand worth a third as much.
    render(<CelebrationBanner celebration={stamp("triple yakuman")} />);

    expect(screen.getAllByText("三").length).toBeGreaterThan(0);
    expect(screen.getAllByText("倍").length).toBeGreaterThan(0);
  });
});
