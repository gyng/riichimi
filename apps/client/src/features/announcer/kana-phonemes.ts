/**
 * Katakana to the phonemes Kokoro was trained on.
 *
 * The neural engine ships an English grapheme-to-phoneme step and refuses its
 * own Japanese voices because of it. The model has them — `jf_alpha` is in the
 * published weights — and its lower-level entry point takes phoneme ids, so the
 * missing piece is only the reading. Japanese is regular enough that a mora
 * table covers it, and this app speaks a closed vocabulary of about sixty terms
 * it writes itself, so there is nothing here to guess at.
 *
 * The inventory is IPA as misaki produces it for Japanese: ɯ rather than u, ɾ
 * for the r-row, ɴ for the moraic nasal.
 */

/** Two-kana combinations, matched before single kana. */
const DIGRAPHS: Readonly<Record<string, string>> = {
  キャ: "kja",
  キュ: "kjɯ",
  キョ: "kjo",
  ギャ: "ɡja",
  ギュ: "ɡjɯ",
  ギョ: "ɡjo",
  シャ: "ɕa",
  シュ: "ɕɯ",
  ショ: "ɕo",
  シェ: "ɕe",
  ジャ: "dʑa",
  ジュ: "dʑɯ",
  ジョ: "dʑo",
  ジェ: "dʑe",
  チャ: "tɕa",
  チュ: "tɕɯ",
  チョ: "tɕo",
  チェ: "tɕe",
  ニャ: "ɲa",
  ニュ: "ɲɯ",
  ニョ: "ɲo",
  ヒャ: "ça",
  ヒュ: "çɯ",
  ヒョ: "ço",
  ビャ: "bja",
  ビュ: "bjɯ",
  ビョ: "bjo",
  ピャ: "pja",
  ピュ: "pjɯ",
  ピョ: "pjo",
  ミャ: "mja",
  ミュ: "mjɯ",
  ミョ: "mjo",
  リャ: "ɾja",
  リュ: "ɾjɯ",
  リョ: "ɾjo",
  ファ: "ɸa",
  フィ: "ɸi",
  フェ: "ɸe",
  フォ: "ɸo",
  ティ: "ti",
  ディ: "di",
  トゥ: "tɯ",
  ドゥ: "dɯ",
  ウィ: "wi",
  ウェ: "we",
  ウォ: "wo",
};

const MORA: Readonly<Record<string, string>> = {
  ア: "a",
  イ: "i",
  ウ: "ɯ",
  エ: "e",
  オ: "o",
  カ: "ka",
  キ: "ki",
  ク: "kɯ",
  ケ: "ke",
  コ: "ko",
  ガ: "ɡa",
  ギ: "ɡi",
  グ: "ɡɯ",
  ゲ: "ɡe",
  ゴ: "ɡo",
  サ: "sa",
  シ: "ɕi",
  ス: "sɯ",
  セ: "se",
  ソ: "so",
  ザ: "za",
  ジ: "dʑi",
  ズ: "zɯ",
  ゼ: "ze",
  ゾ: "zo",
  タ: "ta",
  チ: "tɕi",
  ツ: "tsɯ",
  テ: "te",
  ト: "to",
  ダ: "da",
  ヂ: "dʑi",
  ヅ: "zɯ",
  デ: "de",
  ド: "do",
  ナ: "na",
  ニ: "ɲi",
  ヌ: "nɯ",
  ネ: "ne",
  ノ: "no",
  ハ: "ha",
  ヒ: "çi",
  フ: "ɸɯ",
  ヘ: "he",
  ホ: "ho",
  バ: "ba",
  ビ: "bi",
  ブ: "bɯ",
  ベ: "be",
  ボ: "bo",
  パ: "pa",
  ピ: "pi",
  プ: "pɯ",
  ペ: "pe",
  ポ: "po",
  マ: "ma",
  ミ: "mi",
  ム: "mɯ",
  メ: "me",
  モ: "mo",
  ヤ: "ja",
  ユ: "jɯ",
  ヨ: "jo",
  ラ: "ɾa",
  リ: "ɾi",
  ル: "ɾɯ",
  レ: "ɾe",
  ロ: "ɾo",
  ワ: "wa",
  ヲ: "o",
  ン: "ɴ",
  ヴ: "bɯ",
};

/** Punctuation the voice should hear as a pause rather than skip. */
const MARKS: Readonly<Record<string, string>> = {
  "、": ", ",
  "。": ". ",
  "！": "! ",
  " ": " ",
};

/**
 * Reads a katakana string as phonemes. Anything it does not recognize is
 * dropped rather than guessed at: a stray character should cost a word, never
 * turn the rest of the line into noise.
 */
export function kanaToPhonemes(kana: string): string {
  let out = "";
  let index = 0;

  while (index < kana.length) {
    const pair = kana.slice(index, index + 2);
    const single = kana.charAt(index);

    const digraph = DIGRAPHS[pair];
    if (digraph !== undefined) {
      out += digraph;
      index += 2;
      continue;
    }

    // A long mark holds the vowel just spoken.
    if (single === "ー") {
      if (out.length > 0) {
        out += "ː";
      }
      index += 1;
      continue;
    }

    // A small tsu doubles the consonant that follows it.
    if (single === "ッ") {
      const nextPair = kana.slice(index + 1, index + 3);
      const next = DIGRAPHS[nextPair] ?? MORA[kana.charAt(index + 1)];
      if (next !== undefined) {
        out += next.charAt(0);
      }
      index += 1;
      continue;
    }

    const mora = MORA[single];
    if (mora !== undefined) {
      // ウ after an o or an ɯ lengthens the vowel rather than adding one:
      // ジュウ is dʑɯː and ホウテイ is hoːtei. Spelled out as two vowels a
      // voice says "ju-u" and "ho-u-tei", which is not how the word is said.
      const lengthens = single === "ウ" && (out.endsWith("o") || out.endsWith("ɯ"));
      out += lengthens ? "ː" : mora;
      index += 1;
      continue;
    }

    const mark = MARKS[single];
    if (mark !== undefined) {
      out += mark;
    }
    index += 1;
  }

  return out.trim();
}
