import type { ScoreHandInput, ScoringRules } from "@riichimi/score-core";
import { scoreHand } from "@riichimi/score-core";
import { render, screen } from "@testing-library/react-native";

import { ScoreResultPanel } from "./score-result-panel";

// A ruleset that recognizes single-yaku double yakuman, like a house table.
const doubleRules = {
  allowOpenTanyao: true,
  countedLimit: "yonbaiman",
  doubleWindPairFu: 2,
  doubleYakuman: true,
  id: "house",
  kiriageMangan: false,
  label: "House rules",
  maxYakumanMultiple: null,
  redFives: false,
  revision: "house",
  sourceUrl: null,
  uraDora: true,
  yakumanStacking: "additive",
} as const satisfies ScoringRules;

const kokushiThirteenWait: ScoreHandInput = {
  // All thirteen orphans held; the winning red completes the pair (13-sided wait).
  concealedTiles: ["1m", "9m", "1p", "9p", "1s", "9s", "east", "south", "west", "north", "white", "green", "red", "red"], // prettier-ignore
  context: {
    chankan: false,
    firstTurn: "none",
    honba: 0,
    ippatsu: false,
    lastTile: "none",
    method: "ron",
    riichi: "none",
    riichiSticks: 0,
    rinshan: false,
    roundWind: "east",
    seatWind: "south",
  },
  doraIndicators: [],
  melds: [],
  rules: doubleRules,
  uraDoraIndicators: [],
  winningTile: "red",
};

describe("ScoreResultPanel", () => {
  it("renders a single-yaku double yakuman as a 2× line under a ruleset that pays it", async () => {
    await render(<ScoreResultPanel result={scoreHand(kokushiThirteenWait)} />);

    expect(screen.getByText("Thirteen orphans")).toBeOnTheScreen();
    // The value multiplier is shown, not a hardcoded "1×".
    expect(screen.getByText("2×")).toBeOnTheScreen();
  });

  it("renders a normal yakuman as a 1× line", async () => {
    await render(
      <ScoreResultPanel result={scoreHand({ ...kokushiThirteenWait, rules: doubleRules, winningTile: "red", concealedTiles: ["1m", "1m", "9m", "1p", "9p", "1s", "9s", "east", "south", "west", "north", "white", "green", "red"] })} />, // prettier-ignore
    );

    expect(screen.getByText("Thirteen orphans")).toBeOnTheScreen();
    expect(screen.getByText("1×")).toBeOnTheScreen();
  });
});
