import { describe, expect, it } from "vitest";

import { kanaToPhonemes } from "./kana-phonemes";
import { numberToKana } from "./japanese-number";

/**
 * These readings are what reaches the neural model. Getting one wrong is not a
 * typo but a mispronounced yaku, and nothing downstream can catch it — the
 * model will happily say whatever it is handed.
 */
describe("reading katakana as phonemes", () => {
  it("reads the plain moras", () => {
    expect(kanaToPhonemes("ツモ")).toBe("tsɯmo");
    expect(kanaToPhonemes("ロン")).toBe("ɾoɴ");
    expect(kanaToPhonemes("ピンフ")).toBe("piɴɸɯ");
  });

  it("holds a vowel through a long mark", () => {
    expect(kanaToPhonemes("リーチ")).toBe("ɾiːtɕi");
    expect(kanaToPhonemes("チートイツ")).toBe("tɕiːtoitsɯ");
  });

  it("doubles the consonant after a small tsu", () => {
    expect(kanaToPhonemes("イッパツ")).toBe("ippatsɯ");
    expect(kanaToPhonemes("イッツー")).toBe("ittsɯː");
  });

  it("reads the palatalized pairs as one mora", () => {
    expect(kanaToPhonemes("リャンペーコー")).toBe("ɾjaɴpeːkoː");
    expect(kanaToPhonemes("ジュンチャン")).toBe("dʑɯɴtɕaɴ");
    expect(kanaToPhonemes("ショウサンゲン")).toBe("ɕoːsaɴɡeɴ");
  });

  it("lengthens a vowel through ウ, the way the word is actually said", () => {
    // "hoɯtei" would be ho-u-tei: two vowels where the word has one long one.
    expect(kanaToPhonemes("ホウテイ")).toBe("hoːtei");
    expect(kanaToPhonemes("ホンロウトウ")).toBe("hoɴɾoːtoː");
    expect(kanaToPhonemes("ジュウ")).toBe("dʑɯː");
    expect(kanaToPhonemes("キュウ")).toBe("kjɯː");
  });

  it("keeps punctuation, because that is where the voice breathes", () => {
    expect(kanaToPhonemes("ツモ、リーチ！")).toBe("tsɯmo, ɾiːtɕi!");
  });

  it("drops what it does not know rather than guessing at it", () => {
    // A stray character should cost a word, never derail the rest of the line.
    expect(kanaToPhonemes("ツモ★モ")).toBe("tsɯmomo");
    expect(kanaToPhonemes("")).toBe("");
  });

  it("has a reading for every number this app says out loud", () => {
    // Points, han, fu and dora counts all pass through the number reader first,
    // so anything it produces has to be readable here.
    for (const value of [0, 1, 2, 8, 10, 25, 40, 110, 600, 1500, 8000, 12_000, 32_000, 192_000]) {
      const phonemes = kanaToPhonemes(numberToKana(value));
      expect(phonemes, `no reading for ${value}`).not.toBe("");
      expect(phonemes, `unread kana in ${value}`).not.toMatch(/[ァ-ヿ]/);
    }
  });
});

describe("reading numbers in Japanese", () => {
  it("counts the way Japanese counts, including the irregular ones", () => {
    expect(numberToKana(1)).toBe("イチ");
    expect(numberToKana(10)).toBe("ジュウ");
    expect(numberToKana(25)).toBe("ニジュウゴ");
    expect(numberToKana(600)).toBe("ロッピャク");
    expect(numberToKana(8000)).toBe("ハッセン");
    expect(numberToKana(1500)).toBe("センゴヒャク");
  });

  it("counts in units of ten thousand, as a scoreboard does", () => {
    expect(numberToKana(12_000)).toBe("イチマンニセン");
    expect(numberToKana(32_000)).toBe("サンマンニセン");
    expect(numberToKana(192_000)).toBe("ジュウキュウマンニセン");
  });

  it("says zero rather than nothing", () => {
    expect(numberToKana(0)).toBe("ゼロ");
  });
});
