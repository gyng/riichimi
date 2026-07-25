import { describe, expect, it } from "vitest";
import { isLocale, messages, resolveLocale, supportedLocales } from "./messages";

describe("locale resolution", () => {
  it("keeps an exactly supported locale", () => {
    expect(resolveLocale("ja")).toBe("ja");
    expect(resolveLocale("zh-Hans")).toBe("zh-Hans");
  });

  it("narrows a regional tag to the locale we ship", () => {
    expect(resolveLocale("ja-JP")).toBe("ja");
    expect(resolveLocale("zh-Hans-CN")).toBe("zh-Hans");
    expect(resolveLocale("zh-CN")).toBe("zh-Hans");
  });

  it("sends readers of traditional characters to the traditional set", () => {
    // Script wins when stated; otherwise the region decides.
    expect(resolveLocale("zh-Hant")).toBe("zh-Hant");
    expect(resolveLocale("zh-Hant-TW")).toBe("zh-Hant");
    expect(resolveLocale("zh-TW")).toBe("zh-Hant");
    expect(resolveLocale("zh-HK")).toBe("zh-Hant");
    expect(resolveLocale("zh-MO")).toBe("zh-Hant");
    expect(resolveLocale("zh-SG")).toBe("zh-Hans");
  });

  it("falls back to English for an unknown or absent locale", () => {
    expect(resolveLocale(null)).toBe("en");
    expect(resolveLocale("de-DE")).toBe("en");
    expect(resolveLocale("")).toBe("en");
  });

  it("rejects a tag that is not a shipped locale", () => {
    expect(isLocale("ko")).toBe(false);
    expect(isLocale("ja")).toBe(true);
  });

  it("translates every shipped locale so no surface falls back mid-screen", () => {
    for (const locale of supportedLocales) {
      const entry = messages[locale];
      expect(entry.localeName.length).toBeGreaterThan(0);
      for (const value of Object.values(entry.nav)) {
        expect(value.length).toBeGreaterThan(0);
      }
      for (const value of Object.values(entry.home)) {
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });
});
