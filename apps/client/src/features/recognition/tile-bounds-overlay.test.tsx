import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { TileBoundsOverlay } from "./tile-bounds-overlay";
import type { TileBoundsBox } from "./tile-bounds-overlay";

const boxes: readonly TileBoundsBox[] = [
  {
    badge: "1",
    bounds: { height: 0.4, width: 0.1, x: 0.1, y: 0.2 },
    id: "hand-0",
    label: "Hand tile 1",
    needsReview: false,
  },
  {
    badge: "2",
    bounds: { height: 0.4, width: 0.1, x: 0.3, y: 0.2 },
    id: "hand-1",
    label: "Hand tile 2",
    needsReview: true,
  },
];

describe("TileBoundsOverlay", () => {
  it("offers every detection as a box that can be selected from the photo", async () => {
    const onSelect = vi.fn<(id: string) => void>();
    render(<TileBoundsOverlay boxes={boxes} onSelect={onSelect} selectedId="hand-0" />);

    // Each box carries the tile's accessible name and its selection state.
    expect(screen.getByRole("button", { name: "Hand tile 1", pressed: true })).toBeInTheDocument();
    const flagged = screen.getByRole("button", { name: "Hand tile 2", pressed: false });

    fireEvent.click(flagged);
    expect(onSelect).toHaveBeenCalledWith("hand-1");
  });

  it("marks a flagged box so review is not signalled by colour alone", async () => {
    render(
      <TileBoundsOverlay
        boxes={boxes}
        onSelect={vi.fn<(id: string) => void>()}
        selectedId={null}
      />,
    );

    // The flagged box marks its badge with a warning shape, not colour alone;
    // the confident one shows a plain number.
    expect(screen.getByText("▲2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
