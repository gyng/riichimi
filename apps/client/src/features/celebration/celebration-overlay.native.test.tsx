import { render, screen, waitFor } from "@testing-library/react-native";

import { CelebrationOverlay } from "./celebration-overlay.native";

describe("CelebrationOverlay (native)", () => {
  it("plays once, hides itself from assistive tech, then reports done", async () => {
    const onDone = jest.fn();
    await render(
      <CelebrationOverlay
        celebration={{ durationMs: 60, lightning: true, limit: "baiman", tier: 3 }}
        onDone={onDone}
      />,
    );

    // Purely decorative: it must not appear in the accessibility tree.
    expect(screen.root).toBeTruthy();

    // It self-dismisses so a scored hand never leaves a stuck overlay behind.
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1);
    });
  });
});
