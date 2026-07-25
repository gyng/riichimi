import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { supportedLocales } from "./messages";
import { translate } from "./catalog";

const sourceRoot = join(__dirname, "..");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry: string) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return path.endsWith(".tsx") && !path.endsWith(".test.tsx") ? [path] : [];
  });
}

/**
 * Strings a player reads have to go through `t`. Finding them by shape is
 * imperfect, so this looks only at the props that always render text and at
 * sentence-like literals, which is where untranslated copy actually hid.
 */
const textProps =
  /(?<![-\w])(?:label|title|placeholder|aria-label|accessibilityLabel)=\{?"([^"]{4,})"/g;
// Accessible names count as copy: a screen reader is reading them out. Only
// literal ones are caught — a name composed from a tile, a player, or a count is
// built at runtime, and translating those needs an interpolating translator and a
// locale-aware `tileAccessibleName`, which is a feature rather than a regex.
// JSX text sits between a tag close `>` or expression `}` on the left and a tag
// open `<` or expression `{` on the right. Matching both sides — and allowing
// curly quotes and ellipsis inside — closes the gaps where raw copy hid next to
// a {t(...)} call, a {"\n"} break, or a “quoted” phrase.
const sentence = /[>}]\s*([A-Z][a-z][A-Za-z0-9 ,.'’“”—·…:;!?()/-]{14,})\s*[<{]/g;

// Proper names and identifiers are not copy: they read the same in every locale.
// Anchored end-to-end so a brand name only exempts itself — a whole sentence that
// merely begins with "Riichimi" is still copy and must go through the translator.
const exempt =
  /^(?:RIICHIMI|Riichimi|WRC|EMA|JPML|M\.League|Tenhou|World Riichi Rules 2025|House rules|English)$/;

// Proper nouns and numerals read the same in every language, so a translation
// identical to the source is correct for these rather than missing.
const sameInEveryLanguage = new Set(["2 fu", "4 fu"]);

describe("interface copy is translatable", () => {
  it("routes every user-facing string on a screen through the translator", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(sourceRoot)) {
      // Collapse whitespace first: JSX wraps long copy across lines, and copy
      // that wraps is exactly the copy most likely to be missed.
      const contents = readFileSync(file, "utf8").replaceAll(/\s+/g, " ");
      for (const pattern of [textProps, sentence]) {
        pattern.lastIndex = 0;
        let match = pattern.exec(contents);
        while (match !== null) {
          const literal = match[1]?.trim() ?? "";
          if (literal.length > 0 && !exempt.test(literal)) {
            offenders.push(`${file.replace(sourceRoot, "")}: ${literal.slice(0, 60)}`);
          }
          match = pattern.exec(contents);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("translates a known string into every locale rather than echoing English", () => {
    const translations = supportedLocales.map((locale) => [locale, translate(locale, "Tsumo")]);

    expect(translations).toEqual([
      ["en", "Tsumo"],
      ["ja", "ツモ"],
      ["zh-Hans", "自摸"],
      ["zh-Hant", "自摸"],
    ]);
  });

  it("has a translation for every string the interface asks for", () => {
    // Reading the call sites rather than the catalog: an entry nobody uses is
    // harmless, but a `t(...)` with no entry silently renders English.
    const asked = new Set<string>();
    for (const file of sourceFiles(sourceRoot)) {
      const contents = readFileSync(file, "utf8");
      const call = /\bt\(\s*("(?:[^"\\]|\\.)*")/g;
      let match = call.exec(contents);
      while (match !== null) {
        const literal = match[1];
        if (literal !== undefined) {
          const parsed: unknown = JSON.parse(literal);
          if (typeof parsed === "string") {
            asked.add(parsed);
          }
        }
        match = call.exec(contents);
      }
    }

    const untranslated = [...asked]
      .filter((source) => !sameInEveryLanguage.has(source))
      .flatMap((source) =>
        supportedLocales
          .filter((locale) => locale !== "en" && translate(locale, source) === source)
          .map((locale) => `${locale}: ${source}`),
      );

    expect(untranslated).toEqual([]);
    expect(asked.size).toBeGreaterThan(100);
  });

  it("falls back to the source string for copy that has no entry", () => {
    expect(translate("ja", "a string nobody has translated")).toBe(
      "a string nobody has translated",
    );
  });
});

// The scanner above is only a guard if it keeps catching the shapes that once
// slipped through. These lock in the specific gaps that hid untranslated copy,
// so loosening the regex or the brand exemption fails a test rather than a user.
describe("untranslated-copy scanner", () => {
  const findAll = (source: string): string[] => {
    sentence.lastIndex = 0;
    const found: string[] = [];
    let match = sentence.exec(source);
    while (match !== null) {
      if (match[1] !== undefined) {
        found.push(match[1].trim());
      }
      match = sentence.exec(source);
    }
    return found;
  };

  it("catches a raw literal wherever JSX can place it", () => {
    // After a tag close, after a {t(...)} sibling, terminated by ellipsis, and
    // with curly quotes — every position that previously escaped the scanner.
    expect(findAll(">Show us the tiles.{")).toContain("Show us the tiles.");
    expect(findAll("} Keep the photo here. <")).toContain("Keep the photo here.");
    expect(findAll(">Reading 15 tile faces offline…<")).toContain("Reading 15 tile faces offline…");
    expect(findAll(">No camera on “this” device today<")).toContain(
      "No camera on “this” device today",
    );
  });

  it("reads an accessible name as copy, and a composed one not at all", () => {
    const findProps = (source: string): string[] => {
      textProps.lastIndex = 0;
      const found: string[] = [];
      let match = textProps.exec(source);
      while (match !== null) {
        found.push(match[1] ?? "");
        match = textProps.exec(source);
      }
      return found;
    };

    expect(findProps('label="Copy summary"')).toEqual(["Copy summary"]);
    expect(findProps('aria-label="Shareable game summary"')).toEqual(["Shareable game summary"]);
    // Composed at runtime, so there is no literal for the scanner to read.
    expect(findProps("aria-label={`Remove score ${index + 1}`}")).toEqual([]);
  });

  it("exempts a brand name only when it stands alone", () => {
    expect(exempt.test("Riichimi")).toBe(true);
    expect(exempt.test("House rules")).toBe(true);
    // A sentence that merely begins with the brand is still copy.
    expect(exempt.test("Riichimi asks for camera access only when you choose to scan.")).toBe(
      false,
    );
  });
});
