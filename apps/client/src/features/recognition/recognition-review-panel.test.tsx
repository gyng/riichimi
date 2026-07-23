import { fireEvent, render, screen } from "@testing-library/react-native";

import { RecognitionReviewPanel } from "./recognition-review-panel";

describe("RecognitionReviewPanel", () => {
  it("turns a low-confidence proposal into an explicit reviewed correction", async () => {
    const onChange = jest.fn();
    await render(
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

    expect(screen.getByText("1 tile needs confirmation")).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole("button", { name: "Use 2 characters for selected tile" }),
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        detections: expect.arrayContaining([
          expect.objectContaining({ confidence: 1, id: "hand-0", tile: "2m" }),
        ]),
      }),
    );
  });

  it("shows a called meld tile in review and keeps its meld role when corrected", async () => {
    const onChange = jest.fn();
    await render(
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
    expect(screen.getByText("1 tile needs confirmation")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Use 3 circles for selected tile" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        detections: expect.arrayContaining([
          expect.objectContaining({ id: "meld-0-0", role: "meld", tile: "3p" }),
        ]),
      }),
    );
  });

  it("folds a mis-read called set back into the concealed hand at review", async () => {
    const onChange = jest.fn();
    await render(
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
    expect(screen.getByText("1 concealed tile · 1 called set")).toBeOnTheScreen();
    await fireEvent.press(
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
    const [[folded]] = onChange.mock.calls;
    expect(folded.detections.some((d: { role: string }) => d.role === "meld")).toBe(false);
  });

  it("requires an explicit structure confirmation for an ambiguous single-row capture", async () => {
    const onConfirmStructureChange = jest.fn();
    await render(
      <RecognitionReviewPanel
        initialReviewCount={0}
        onChange={jest.fn()}
        onConfirmStructureChange={onConfirmStructureChange}
        requireStructureConfirmation
        structureConfirmed={false}
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
    expect(
      screen.getByText(
        "If any concealed tile is actually part of a called set, add that set in the calculator.",
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole("checkbox", { name: /concealed and called split matches the photo/ }),
    );
    expect(onConfirmStructureChange).toHaveBeenCalledWith(true);
  });

  it("allows the winner to be reassigned without creating two winning tiles", async () => {
    const onChange = jest.fn();
    await render(
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

    await fireEvent.press(
      screen.getByRole("button", {
        name: "Hand tile 2, 2 characters, 99 percent confidence",
      }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Mark as winning tile" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        detections: [
          expect.objectContaining({ role: "concealed" }),
          expect.objectContaining({ role: "winning" }),
        ],
      }),
    );
  });
});
