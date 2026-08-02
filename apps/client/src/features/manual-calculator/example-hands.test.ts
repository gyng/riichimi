import { scoreHand } from "@riichimi/score-core";
import { scoringRulesProfile } from "@riichimi/rules";
import { describe, expect, it } from "vitest";

import { randomExampleHand } from "./example-hands";

/**
 * Deterministic so a failure can be reproduced from its seed rather than
 * chased. Nothing here mocks the scorer: the whole point is that these hands
 * survive the real one.
 */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const rules = scoringRulesProfile("wrc-2025");

function score(seed: number) {
  const hand = randomExampleHand(seeded(seed));
  const winningTile = hand.concealed[hand.winningIndex];
  return {
    hand,
    result: scoreHand({
      concealedTiles: hand.concealed,
      context: {
        chankan: false,
        firstTurn: "none",
        honba: 0,
        ippatsu: false,
        lastTile: "none",
        method: hand.method,
        riichi: hand.riichi,
        riichiSticks: 0,
        rinshan: false,
        roundWind: hand.roundWind,
        seatWind: hand.seatWind,
      },
      doraIndicators: hand.doraIndicators,
      melds: [],
      rules,
      uraDoraIndicators: [],
      winningTile: winningTile!,
    }),
  };
}

describe("example hands", () => {
  it("always produces a hand that scores", () => {
    // The button's whole promise. A hand that comes back "not a complete hand"
    // or "a yaku is still needed" is worse than no button at all, because the
    // player cannot tell whether they broke it.
    const failures: string[] = [];
    for (let seed = 1; seed <= 400; seed += 1) {
      const { hand, result } = score(seed);
      if (result.kind !== "success") {
        failures.push(`seed ${seed} (${hand.label}): ${result.kind}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it("always deals exactly fourteen tiles, four to a kind at most", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const { hand } = score(seed);
      expect(hand.concealed).toHaveLength(14);
      const counts = new Map<string, number>();
      for (const tile of hand.concealed) {
        counts.set(tile, (counts.get(tile) ?? 0) + 1);
      }
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(4);
    }
  });

  it("points the winning tile at a tile that is in the hand", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const { hand } = score(seed);
      expect(hand.winningIndex).toBeGreaterThanOrEqual(0);
      expect(hand.winningIndex).toBeLessThan(hand.concealed.length);
    }
  });

  it("keeps big hands rare and ordinary hands ordinary", () => {
    // Pressing the button repeatedly should look like mahjong, not like a
    // highlight reel: if every third press were a yakuman the spread would be
    // teaching the wrong thing.
    let yakuman = 0;
    let scored = 0;
    for (let seed = 1; seed <= 400; seed += 1) {
      const { result } = score(seed);
      if (result.kind !== "success") {
        continue;
      }
      scored += 1;
      if (result.yakuman.length > 0) {
        yakuman += 1;
      }
    }

    expect(scored).toBe(400);
    expect(yakuman / scored).toBeLessThan(0.12);
    expect(yakuman).toBeGreaterThan(0);
  });

  it("varies from press to press", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed += 1) {
      seen.add(score(seed).hand.concealed.join(","));
    }

    expect(seen.size).toBeGreaterThan(30);
  });
});
