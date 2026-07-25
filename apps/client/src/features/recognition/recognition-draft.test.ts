import { describe, expect, it } from "vitest";
import { inferMeld, parseRecognitionDraft } from "./recognition-draft";

describe("inferMeld", () => {
  it("reads a chi (sequence), preserving a red five and ordering low-to-high", () => {
    expect(inferMeld(["4m", "0m", "3m"])).toEqual({
      kind: "sequence",
      open: true,
      tiles: ["3m", "4m", "0m"],
    });
  });

  it("reads a pon (triplet) at its canonical tile", () => {
    expect(inferMeld(["white", "white", "white"])).toEqual({
      kind: "triplet",
      open: true,
      tile: "white",
    });
    expect(inferMeld(["5s", "0s", "5s"])).toEqual({ kind: "triplet", open: true, tile: "5s" });
  });

  it("reads a four-tile group as an open kan", () => {
    expect(inferMeld(["1p", "1p", "1p", "1p"])).toEqual({ kind: "quad", open: true, tile: "1p" });
  });

  it("rejects groups that are not a legal meld", () => {
    expect(inferMeld(["1m", "2m", "4m"])).toBeNull(); // not consecutive
    expect(inferMeld(["1m", "2p", "3s"])).toBeNull(); // mixed suits
    expect(inferMeld(["east", "south", "west"])).toBeNull(); // honours cannot form a run
    expect(inferMeld(["1m", "2m"])).toBeNull(); // too few
    expect(inferMeld(["1m", "2m", "3m", "4m", "5m"])).toBeNull(); // too many
  });
});

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
    ).toMatchObject({ melds: [], reviewedCount: 2, winningIndex: 11 });
  });

  it("accepts a hand with a called meld and fewer concealed tiles", () => {
    const draft = parseRecognitionDraft({
      dora: "9s",
      melds: "2p,3p,4p",
      modelVersion: "guided-v0",
      reviewedCount: "1",
      tiles: "1m,2m,3m,4m,5m,6m,7m,8m,9m,5s,5s", // 11 concealed = 14 - 3
      winningIndex: "8",
    });
    expect(draft?.concealedTiles).toHaveLength(11);
    expect(draft?.melds).toEqual([{ kind: "sequence", open: true, tiles: ["2p", "3p", "4p"] }]);
  });

  it("rejects a concealed count that does not match the declared melds", () => {
    expect(
      parseRecognitionDraft({
        dora: "9s",
        melds: "2p,3p,4p",
        modelVersion: "guided-v0",
        reviewedCount: "0",
        tiles: "1m,2m,3m,4m,5m,6m,7m,8m,9m,5s,5s,6s,7s,8s", // 14, but a meld needs 11
        winningIndex: "0",
      }),
    ).toBeUndefined();
  });

  it("rejects a meld group that is not a legal meld", () => {
    expect(
      parseRecognitionDraft({
        dora: "9s",
        melds: "1m,2m,4m",
        modelVersion: "guided-v0",
        reviewedCount: "0",
        tiles: "1m,2m,3m,4m,5m,6m,7m,8m,9m,5s,5s",
        winningIndex: "0",
      }),
    ).toBeUndefined();
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
