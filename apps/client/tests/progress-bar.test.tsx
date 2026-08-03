import { describe, expect, it } from "vitest";
import { ProgressBar } from "@riichimi/ui";
import { render, screen } from "@testing-library/react";

describe("the progress bar", () => {
  it("reports how far along measurable work is", () => {
    render(<ProgressBar label="Fetching the voice" value={0.42} />);

    const bar = screen.getByRole("progressbar", { name: "Fetching the voice" });
    expect(bar).toHaveAttribute("aria-valuenow", "0.42");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "1");
  });

  it("says nothing about an amount it cannot know", () => {
    // A screen reader should hear "busy", not a number the app invented.
    render(<ProgressBar label="Reading the hand" />);

    expect(screen.getByRole("progressbar", { name: "Reading the hand" })).not.toHaveAttribute(
      "aria-valuenow",
    );
  });

  it("keeps a nonsensical value inside the track", () => {
    // Download callbacks have been known to report past the end.
    render(<ProgressBar label="Over" value={4} />);

    expect(screen.getByRole("progressbar", { name: "Over" })).toHaveAttribute("aria-valuenow", "1");
  });

  it("treats a missing measurement as unmeasurable rather than as zero", () => {
    render(<ProgressBar label="Unknown" value={Number.NaN} />);

    expect(screen.getByRole("progressbar", { name: "Unknown" })).not.toHaveAttribute(
      "aria-valuenow",
    );
  });
});
