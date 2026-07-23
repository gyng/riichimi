import { parseRecognitionDraft } from "./recognition-draft";

describe("recognition draft route boundary", () => {
  it("accepts one complete, structurally bounded recognized hand", () => {
    expect(
      parseRecognitionDraft({
        dora: "9s",
        modelVersion: "guided-v0",
        reviewedCount: "2",
        tiles: "1m,2m,3m,4m,5m,6m,7p,8p,9p,2s,3s,4s,5p,5p",
        winningIndex: "11",
      }),
    ).toMatchObject({ reviewedCount: 2, winningIndex: 11 });
  });

  it("rejects malformed or partial route input", () => {
    expect(parseRecognitionDraft({ tiles: "1m,2m", winningIndex: "99" })).toBeUndefined();
    expect(
      parseRecognitionDraft({
        dora: "not-a-tile",
        modelVersion: "guided-v0",
        reviewedCount: "0",
        tiles: Array.from({ length: 14 }, () => "1m").join(","),
        winningIndex: "3",
      }),
    ).toBeUndefined();
  });
});
