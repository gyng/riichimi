import { render, screen } from "@testing-library/react-native";

import { CelebrationBanner } from "./celebration-banner";

describe("CelebrationBanner", () => {
  it("stamps the limit in kanji, one character each, hidden from assistive tech", async () => {
    await render(
      <CelebrationBanner
        celebration={{ durationMs: 120, lightning: true, limit: "yakuman", tier: 6 }}
      />,
    );

    // 役満 is rendered a character at a time so each can reveal on its own.
    // The banner is hidden from assistive tech, so include hidden elements.
    expect(screen.getByText("役", { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText("満", { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it("falls back to 役満 for a multi-yakuman limit name", async () => {
    await render(
      <CelebrationBanner
        celebration={{ durationMs: 120, lightning: true, limit: "3x yakuman", tier: 7 }}
      />,
    );

    expect(screen.getByText("役", { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
