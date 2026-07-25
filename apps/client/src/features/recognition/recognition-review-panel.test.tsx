import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type { RecognitionResult } from "@riichimi/vision";

import { RecognitionReviewPanel } from "./recognition-review-panel";

describe("RecognitionReviewPanel", () => {
  it("turns a low-confidence proposal into an explicit reviewed correction", async () => {
    const onChange = vi.fn<(result: RecognitionResult) => void>();
    render(
      <RecognitionReviewPanel
        initialReviewCount={1}
        onChange={onChange}
        result={{
          detections: [
            {
              alternatives: [
                { confidence: 0.55, tile: "1m" },
                { confidence: 0.3, tile: "2m" },
              ],
              bounds: { height: 0.4, width: 0.1, x: 0.1, y: 0.2 },
              confidence: 0.55,
              id: "hand-0",
              role: "winning",
              tile: "1m",
            },
            {
              alternatives: [{ confidence: 0.98, tile: "9s" }],
              bounds: { height: 0.4, width: 0.1, x: 0.8, y: 0.6 },
              confidence: 0.98,
              id: "dora-0",
              role: "dora",
              tile: "9s",
            },
          ],
          modelVersion: "test",
        }}
      />,
    );

    expect(screen.getByText("1 tile needs confirmation")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use 2 characters for the selected tile" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        detections: expect.arrayContaining([
          expect.objectContaining({ confidence: 1, id: "hand-0", tile: "2m" }),
        ]),
      }),
    );
  });

  it("shows a called meld tile in review and keeps its meld role when corrected", async () => {
    const onChange = vi.fn<(result: RecognitionResult) => void>();
    render(
      <RecognitionReviewPanel
        initialReviewCount={1}
        onChange={onChange}
        result={{
          detections: [
            {
              alternatives: [{ confidence: 0.95, tile: "5m" }],
              bounds: { height: 0.4, width: 0.1, x: 0.1, y: 0.2 },
              confidence: 0.95,
              id: "hand-0",
              role: "winning",
              tile: "5m",
            },
            {
              alternatives: [
                { confidence: 0.5, tile: "2p" },
                { confidence: 0.4, tile: "3p" },
              ],
              bounds: { height: 0.4, width: 0.1, x: 0.2, y: 0.6 },
              confidence: 0.5,
              id: "meld-0-0",
              role: "meld",
              tile: "2p",
            },
            {
              alternatives: [{ confidence: 0.98, tile: "9s" }],
              bounds: { height: 0.4, width: 0.1, x: 0.8, y: 0.9 },
              confidence: 0.98,
              id: "dora-0",
              role: "dora",
              tile: "9s",
            },
          ],
          modelVersion: "test",
        }}
      />,
    );

    // The low-confidence called-meld tile is flagged and reviewable.
    expect(screen.getByText("1 tile needs confirmation")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use 3 circles for the selected tile" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        detections: expect.arrayContaining([
          expect.objectContaining({ id: "meld-0-0", role: "meld", tile: "3p" }),
        ]),
      }),
    );
  });

  it("folds a mis-read called set back into the concealed hand at review", async () => {
    const onChange = vi.fn<(result: RecognitionResult) => void>();
    render(
      <RecognitionReviewPanel
        initialReviewCount={0}
        onChange={onChange}
        result={{
          detections: [
            {
              alternatives: [{ confidence: 0.99, tile: "7m" }],
              bounds: { height: 0.4, width: 0.1, x: 0.1, y: 0.2 },
              confidence: 0.99,
              id: "hand-0",
              role: "winning",
              tile: "7m",
            },
            ...(["9p", "9p", "9p"] as const).map((tile, index) => ({
              alternatives: [{ confidence: 0.95, tile }],
              bounds: { height: 0.4, width: 0.1, x: 0.3 + index * 0.05, y: 0.2 },
              confidence: 0.95,
              id: `meld-0-${index}`,
              role: "meld" as const,
              tile,
            })),
            {
              alternatives: [{ confidence: 0.98, tile: "3s" }],
              bounds: { height: 0.4, width: 0.1, x: 0.9, y: 0.2 },
              confidence: 0.98,
              id: "dora-0",
              role: "dora",
              tile: "3s",
            },
          ],
          modelVersion: "test",
        }}
      />,
    );

    // The structure is surfaced for confirmation, not just each tile's identity.
    expect(screen.getByText("1 concealed tile · 1 called set")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Called set 1 isn't a call — move to hand" }),
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        detections: expect.arrayContaining([
          expect.objectContaining({ id: "meld-0-0", role: "concealed", tile: "9p" }),
          expect.objectContaining({ id: "meld-0-2", role: "concealed", tile: "9p" }),
        ]),
      }),
    );
    // None of the folded tiles keep the meld role.
    const folded = onChange.mock.calls[0]?.[0];
    expect(folded?.detections.some(({ role }) => role === "meld")).toBe(false);
  });

  it("shows the concealed and called split for an ambiguous single-row capture", async () => {
    render(
      <RecognitionReviewPanel
        initialReviewCount={0}
        onChange={vi.fn<(result: RecognitionResult) => void>()}
        requireStructureConfirmation
        result={{
          detections: [
            {
              alternatives: [{ confidence: 0.99, tile: "1m" }],
              bounds: { height: 0.4, width: 0.1, x: 0.1, y: 0.2 },
              confidence: 0.99,
              id: "hand-0",
              role: "winning",
              tile: "1m",
            },
            {
              alternatives: [{ confidence: 0.98, tile: "9s" }],
              bounds: { height: 0.4, width: 0.1, x: 0.9, y: 0.2 },
              confidence: 0.98,
              id: "dora-0",
              role: "dora",
              tile: "9s",
            },
          ],
          modelVersion: "test",
        }}
      />,
    );

    // Even with no called set, the natural layout must have its split confirmed.
    expect(screen.getByText("Add any missed called set in the calculator.")).toBeInTheDocument();
    // The split is stated so the confirm action names what it is confirming.
    expect(screen.getByText("1 concealed tile · 0 called sets")).toBeInTheDocument();
  });

  it("allows the winner to be reassigned without creating two winning tiles", async () => {
    const onChange = vi.fn<(result: RecognitionResult) => void>();
    render(
      <RecognitionReviewPanel
        initialReviewCount={0}
        onChange={onChange}
        result={{
          detections: [
            {
              alternatives: [{ confidence: 0.99, tile: "1m" }],
              bounds: { height: 0.4, width: 0.1, x: 0.1, y: 0.2 },
              confidence: 0.99,
              id: "hand-0",
              role: "winning",
              tile: "1m",
            },
            {
              alternatives: [{ confidence: 0.99, tile: "2m" }],
              bounds: { height: 0.4, width: 0.1, x: 0.2, y: 0.2 },
              confidence: 0.99,
              id: "hand-1",
              role: "concealed",
              tile: "2m",
            },
          ],
          modelVersion: "test",
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Hand tile 2, 2 characters, 99 percent confidence",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark as winning tile" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        detections: [
          expect.objectContaining({ role: "concealed" }),
          expect.objectContaining({ role: "winning" }),
        ],
      }),
    );
  });

  it("keeps a deliberately selected confident tile selected rather than snapping to a flag", async () => {
    render(
      <RecognitionReviewPanel
        initialReviewCount={1}
        onChange={vi.fn<(result: RecognitionResult) => void>()}
        result={{
          detections: [
            {
              alternatives: [{ confidence: 0.4, tile: "1m" }],
              bounds: { height: 0.4, width: 0.1, x: 0.1, y: 0.2 },
              confidence: 0.4,
              id: "hand-0",
              role: "winning",
              tile: "1m",
            },
            {
              alternatives: [{ confidence: 0.99, tile: "2m" }],
              bounds: { height: 0.4, width: 0.1, x: 0.2, y: 0.2 },
              confidence: 0.99,
              id: "hand-1",
              role: "concealed",
              tile: "2m",
            },
          ],
          modelVersion: "test",
        }}
      />,
    );

    // The low-confidence winning tile is seeded as the selection.
    expect(screen.getByText("SELECTED · Winning tile 1")).toBeInTheDocument();

    // Choosing the confident tile from the list must stick, even though a flag
    // is still outstanding — inspecting any tile is the point of the overlay.
    fireEvent.click(
      screen.getByRole("button", {
        name: "Hand tile 2, 2 characters, 99 percent confidence",
      }),
    );

    expect(screen.getByText("SELECTED · Hand tile 2")).toBeInTheDocument();
  });
});
