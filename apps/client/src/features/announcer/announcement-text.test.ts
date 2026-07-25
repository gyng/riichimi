import { describe, expect, it } from "vitest";
import { announcementLead, announcementTail, announcementText } from "./announcement-text";

describe("announcementText", () => {
  it("speaks the method, headline yaku, value, and points", () => {
    expect(
      announcementText({
        fu: 30,
        han: 4,
        headline: ["Junchan", "Sanshoku"],
        limit: null,
        method: "ron",
        points: 8000,
      }),
    ).toBe("Ron. Junchan. Sanshoku. 4 han 30 fu. 8,000 points.");
  });

  it("uses the limit name instead of han and fu once a hand reaches one", () => {
    expect(
      announcementText({
        fu: null,
        han: null,
        headline: ["Suuankou"],
        limit: "yakuman",
        method: "tsumo",
        points: 32000,
      }),
    ).toBe("Tsumo. Suuankou. yakuman. 32,000 points.");
  });

  it("still announces a hand with no fu breakdown", () => {
    expect(
      announcementText({
        fu: null,
        han: 5,
        headline: [],
        limit: null,
        method: "tsumo",
        points: 12000,
      }),
    ).toBe("Tsumo. 5 han. 12,000 points.");
  });

  it("splits into a yaku lead and a limit climax for a synced reveal", () => {
    const yakuman = {
      fu: null,
      han: null,
      headline: ["Suuankou"],
      limit: "yakuman",
      method: "tsumo",
      points: 32000,
    } as const;

    // The lead reads the method and yaku; the tail lands the limit and points.
    expect(announcementLead(yakuman)).toBe("Tsumo. Suuankou.");
    expect(announcementTail(yakuman)).toBe("yakuman. 32,000 points.");
  });
});
