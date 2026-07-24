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
const textProps = /\b(?:label|title|placeholder)=\{?"([^"]{4,})"/g;
const sentence = />\s*([A-Z][a-z][A-Za-z0-9 ,.'’—·:;!?()/-]{14,})\s*</g;

// Proper names and identifiers are not copy: they read the same in every locale.
const exempt =
  /^(?:RIICHIMI|Riichimi|WRC|EMA|JPML|M\.League|Tenhou|World Riichi Rules 2025|House rules|English)/;

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
