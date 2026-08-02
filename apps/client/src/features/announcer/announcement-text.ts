import type { AnnouncedTerm, WinAnnouncement } from "@riichimi/score-core";

import type { SpokenLine } from "./speech-port";

/**
 * A win, said the way a mahjong parlour says it.
 *
 * Two forms of every line. Japanese is the one this is written for — the terms
 * are Japanese, the game is Japanese, and a Japanese voice reads リーチ, ドラ2
 * and ハネマン the way a player expects to hear them. The romanized form exists
 * because an engine may have no Japanese voice at all: today's neural voice
 * ships English speakers only, and feeding it kana produces noise rather than a
 * voice. Each adapter takes the form it can pronounce.
 */

const methodTerm: Record<WinAnnouncement["method"], SpokenLine> = {
  ron: { japanese: "ロン", romaji: "Ron" },
  tsumo: { japanese: "ツモ", romaji: "Tsumo" },
};

const limitTerm: Readonly<Record<string, SpokenLine>> = {
  baiman: { japanese: "バイマン", romaji: "Baiman" },
  "double yakuman": { japanese: "ダブルヤクマン", romaji: "Double yakuman" },
  haneman: { japanese: "ハネマン", romaji: "Haneman" },
  mangan: { japanese: "マンガン", romaji: "Mangan" },
  "quadruple yakuman": { japanese: "クアドラプルヤクマン", romaji: "Quadruple yakuman" },
  sanbaiman: { japanese: "サンバイマン", romaji: "Sanbaiman" },
  "triple yakuman": { japanese: "トリプルヤクマン", romaji: "Triple yakuman" },
  yakuman: { japanese: "ヤクマン", romaji: "Yakuman" },
  yonbaiman: { japanese: "ヨンバイマン", romaji: "Yonbaiman" },
};

// Dora is counted aloud in Japanese — ドラ2 is said "dora ni", not "dora two" —
// so the romanized form needs the Japanese numeral too, or the two voices would
// be saying different things.
const NUMERAL = [
  "zero",
  "ichi",
  "ni",
  "san",
  "yon",
  "go",
  "roku",
  "nana",
  "hachi",
  "kyuu",
  "juu",
  "juuichi",
  "juuni",
  "juusan",
] as const;

function counted(japanesePrefix: string, romajiPrefix: string, count: number): SpokenLine | null {
  if (count <= 0) {
    return null;
  }
  return {
    // The digit is deliberate: a Japanese voice reads ドラ2 as "ドラに".
    japanese: `${japanesePrefix}${count}`,
    romaji: `${romajiPrefix} ${NUMERAL[count] ?? String(count)}`,
  };
}

/** The domain names a yaku by its reading; here that reading is the line. */
function spoken(term: AnnouncedTerm): SpokenLine {
  return { japanese: term.kana, romaji: term.romaji };
}

function doraTerms(announcement: WinAnnouncement): readonly SpokenLine[] {
  return [
    counted("ドラ", "dora", announcement.dora.dora),
    counted("アカドラ", "aka dora", announcement.dora.redDora),
    counted("ウラドラ", "ura dora", announcement.dora.uraDora),
  ].filter((term): term is SpokenLine => term !== null);
}

/** Han and fu, said only when no limit has replaced them. */
function valueTerm(announcement: WinAnnouncement): SpokenLine | null {
  if (announcement.limit !== null || announcement.han === null) {
    return null;
  }
  if (announcement.fu === null) {
    return { japanese: `${announcement.han}ハン`, romaji: `${announcement.han} han` };
  }
  return {
    japanese: `${announcement.han}ハン${announcement.fu}フ`,
    romaji: `${announcement.han} han ${announcement.fu} fu`,
  };
}

function pointsTerm(announcement: WinAnnouncement): SpokenLine {
  return {
    japanese: `${announcement.points}テン`,
    romaji: `${new Intl.NumberFormat("en-US").format(announcement.points)} points`,
  };
}

/** The limit, after the points — the name a table reacts to. */
function limitTermFor(announcement: WinAnnouncement): SpokenLine | null {
  return announcement.limit === null ? null : (limitTerm[announcement.limit] ?? null);
}

function line(terms: readonly (SpokenLine | null)[], excited: boolean): SpokenLine {
  const kept = terms.filter((term): term is SpokenLine => term !== null);
  if (kept.length === 0) {
    return { japanese: "", romaji: "" };
  }
  // 、between clauses so a Japanese voice pauses without dropping to a full
  // stop; ！ on the climax, which is the one place the delivery should lift.
  return {
    japanese: `${kept.map((term) => term.japanese).join("、")}${excited ? "！" : "。"}`,
    romaji: `${kept.map((term) => term.romaji).join(". ")}${excited ? "!" : "."}`,
  };
}

export function announcementText(announcement: WinAnnouncement): SpokenLine {
  return line(
    [
      methodTerm[announcement.method],
      ...announcement.headline.map(spoken),
      ...doraTerms(announcement),
      valueTerm(announcement),
      pointsTerm(announcement),
      limitTermFor(announcement),
    ],
    announcement.limit !== null,
  );
}

/** The method, the yaku, and the dora — the build-up before the score. */
export function announcementLead(announcement: WinAnnouncement): SpokenLine {
  return line(
    [
      methodTerm[announcement.method],
      ...announcement.headline.map(spoken),
      ...doraTerms(announcement),
    ],
    false,
  );
}

/** The points and then the limit — the climax, spoken as the stamp lands. */
export function announcementTail(announcement: WinAnnouncement): SpokenLine {
  return line(
    [valueTerm(announcement), pointsTerm(announcement), limitTermFor(announcement)],
    announcement.limit !== null,
  );
}
