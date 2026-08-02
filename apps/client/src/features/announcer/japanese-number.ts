/**
 * Numbers as a Japanese voice should say them.
 *
 * The announcement is read by two different engines. A device voice given
 * "12000" reads it correctly; the neural engine is driven from phonemes, and a
 * digit has no phonemes. Spelling the number into kana at the wording layer
 * means both engines are handed the same words, and the sound changes that make
 * Japanese counting irregular — 600 is ロッピャク, not ロクヒャク — happen in
 * one place rather than in a phoneme table.
 */

const DIGIT = ["", "イチ", "ニ", "サン", "ヨン", "ゴ", "ロク", "ナナ", "ハチ", "キュウ"] as const;

/** 100, 300, 600 and 800 change shape; the rest are the plain digit. */
const HUNDRED: Readonly<Record<number, string>> = {
  1: "ヒャク",
  3: "サンビャク",
  6: "ロッピャク",
  8: "ハッピャク",
};

/** 1000 and 3000 and 8000 likewise. */
const THOUSAND: Readonly<Record<number, string>> = {
  1: "セン",
  3: "サンゼン",
  8: "ハッセン",
};

/** Under ten thousand, which is the unit Japanese counts in. */
function underTenThousand(value: number): string {
  const thousands = Math.floor(value / 1000);
  const hundreds = Math.floor((value % 1000) / 100);
  const tens = Math.floor((value % 100) / 10);
  const ones = value % 10;

  return [
    thousands === 0 ? "" : (THOUSAND[thousands] ?? `${DIGIT[thousands] ?? ""}セン`),
    hundreds === 0 ? "" : (HUNDRED[hundreds] ?? `${DIGIT[hundreds] ?? ""}ヒャク`),
    // Ten is ジュウ on its own, not イチジュウ.
    tens === 0 ? "" : tens === 1 ? "ジュウ" : `${DIGIT[tens] ?? ""}ジュウ`,
    DIGIT[ones] ?? "",
  ].join("");
}

/**
 * Reads a whole number in kana. Handles everything this app says out loud:
 * dora counts, han, fu, and payments up to a quadruple yakuman.
 */
export function numberToKana(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return String(value);
  }
  const whole = Math.floor(value);
  if (whole === 0) {
    return "ゼロ";
  }
  if (whole >= 100_000_000) {
    // Beyond anything a hand can pay; say the digits rather than invent a unit.
    return String(whole);
  }

  const tenThousands = Math.floor(whole / 10_000);
  const remainder = whole % 10_000;
  // One man is イチマン, never just マン.
  const lead = tenThousands === 0 ? "" : `${underTenThousand(tenThousands)}マン`;
  return `${lead}${remainder === 0 ? "" : underTenThousand(remainder)}`;
}
