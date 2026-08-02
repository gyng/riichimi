/**
 * Every yaku the scorer can award, as data.
 *
 * The detector used to carry each name, reading, and kanji at its call site,
 * which meant a reference screen could only be a second copy of them — and a
 * second copy drifts. The detector reads its names from here now, so a yaku
 * that exists in the scorer exists in the reference with the same words, and
 * one that does not exist here cannot be constructed at all.
 *
 * Han stays a scoring decision: `closedHan` and `openHan` describe the ordinary
 * case for a reader, while the value actually awarded is computed from the hand
 * and the ruleset. `openHan: null` means the yaku requires a closed hand.
 */
export interface YakuReference {
  /** The ordinary value with no called sets. */
  readonly closedHan: number;
  readonly id: string;
  /** Japanese name in kanji, e.g. 立直. */
  readonly japanese: string;
  /** English name, as the score panel shows it. */
  readonly name: string;
  /** The value once a set has been called, or null when calling forfeits it. */
  readonly openHan: number | null;
  /** One line: what the hand has to look like. */
  readonly requirement: string;
  readonly romanized: string;
}

export interface YakumanReference {
  readonly id: string;
  readonly japanese: string;
  readonly name: string;
  /** Set when a ruleset can pay this one double, and what earns the double. */
  readonly doubleWhen: string | null;
  readonly requirement: string;
  readonly romanized: string;
}

export const yakuCatalog: readonly YakuReference[] = [
  {
    closedHan: 1,
    id: "riichi",
    japanese: "立直",
    name: "Riichi",
    openHan: null,
    requirement: "Declared while closed and one tile from a win, staking 1,000 points.",
    romanized: "Riichi",
  },
  {
    closedHan: 2,
    id: "double-riichi",
    japanese: "ダブル立直",
    name: "Double riichi",
    openHan: null,
    requirement: "Riichi declared on your first turn, with no call before it.",
    romanized: "Daburu riichi",
  },
  {
    closedHan: 1,
    id: "ippatsu",
    japanese: "一発",
    name: "Unbroken",
    openHan: null,
    requirement: "Winning within one go-around of your riichi, with no call in between.",
    romanized: "Ippatsu",
  },
  {
    closedHan: 1,
    id: "menzen-tsumo",
    japanese: "門前清自摸和",
    name: "Fully concealed hand",
    openHan: null,
    requirement: "Drawn by yourself, with no called sets.",
    romanized: "Menzen tsumo",
  },
  {
    closedHan: 1,
    id: "chankan",
    japanese: "槍槓",
    name: "Robbing a quad",
    openHan: 1,
    requirement: "Winning on the tile another player adds to their own open triplet.",
    romanized: "Chankan",
  },
  {
    closedHan: 1,
    id: "rinshan",
    japanese: "嶺上開花",
    name: "After a quad",
    openHan: 1,
    requirement: "Winning on the replacement tile drawn after declaring a quad.",
    romanized: "Rinshan kaihou",
  },
  {
    closedHan: 1,
    id: "haitei",
    japanese: "海底摸月",
    name: "Last tile draw",
    openHan: 1,
    requirement: "Winning on the last tile drawn from the wall.",
    romanized: "Haitei",
  },
  {
    closedHan: 1,
    id: "houtei",
    japanese: "河底撈魚",
    name: "Last tile claim",
    openHan: 1,
    requirement: "Winning on the final discard of the hand.",
    romanized: "Houtei",
  },
  {
    closedHan: 1,
    id: "pinfu",
    japanese: "平和",
    name: "Pinfu",
    openHan: null,
    requirement: "Four runs, a two-sided wait, and a pair that scores no fu.",
    romanized: "Pinfu",
  },
  {
    closedHan: 1,
    id: "tanyao",
    japanese: "断幺九",
    name: "All inside",
    // Whether an open hand keeps it is a ruleset decision; the Setup card names
    // which way each profile goes.
    openHan: 1,
    requirement: "No terminals and no honours anywhere in the hand.",
    romanized: "Tan'yao",
  },
  {
    closedHan: 1,
    id: "iipeikou",
    japanese: "一盃口",
    name: "Twin sequences",
    openHan: null,
    requirement: "Two identical runs in the same suit.",
    romanized: "Iipeikou",
  },
  {
    closedHan: 3,
    id: "ryanpeikou",
    japanese: "二盃口",
    name: "Double twin sequences",
    openHan: null,
    requirement: "Two separate pairs of identical runs.",
    romanized: "Ryanpeikou",
  },
  {
    closedHan: 1,
    id: "yakuhai-white",
    japanese: "白",
    name: "Value honour: white",
    openHan: 1,
    requirement: "A triplet of the white dragon.",
    romanized: "Yakuhai",
  },
  {
    closedHan: 1,
    id: "yakuhai-green",
    japanese: "發",
    name: "Value honour: green",
    openHan: 1,
    requirement: "A triplet of the green dragon.",
    romanized: "Yakuhai",
  },
  {
    closedHan: 1,
    id: "yakuhai-red",
    japanese: "中",
    name: "Value honour: red",
    openHan: 1,
    requirement: "A triplet of the red dragon.",
    romanized: "Yakuhai",
  },
  {
    closedHan: 1,
    id: "yakuhai-seat",
    japanese: "自風",
    name: "Value honour: seat wind",
    openHan: 1,
    requirement: "A triplet of your own seat wind.",
    romanized: "Yakuhai",
  },
  {
    closedHan: 1,
    id: "yakuhai-round",
    japanese: "場風",
    name: "Value honour: round wind",
    openHan: 1,
    requirement: "A triplet of the wind of the current round.",
    romanized: "Yakuhai",
  },
  {
    closedHan: 2,
    id: "sanshoku-doujun",
    japanese: "三色同順",
    name: "Mixed sequences",
    openHan: 1,
    requirement: "The same run in all three suits.",
    romanized: "Sanshoku doujun",
  },
  {
    closedHan: 2,
    id: "ittsuu",
    japanese: "一気通貫",
    name: "Full straight",
    openHan: 1,
    requirement: "1 through 9 of one suit, as three runs.",
    romanized: "Ikkitsuukan",
  },
  {
    closedHan: 2,
    id: "chanta",
    japanese: "混全帯幺九",
    name: "Common ends",
    openHan: 1,
    requirement: "Every set and the pair holds a terminal or an honour, and at least one run.",
    romanized: "Chanta",
  },
  {
    closedHan: 3,
    id: "junchan",
    japanese: "純全帯幺九",
    name: "Perfect ends",
    openHan: 2,
    requirement: "Every set and the pair holds a terminal, with no honours at all.",
    romanized: "Junchan",
  },
  {
    closedHan: 2,
    id: "chiitoitsu",
    japanese: "七対子",
    name: "Seven pairs",
    openHan: null,
    requirement: "Seven different pairs. Always 25 fu.",
    romanized: "Chiitoitsu",
  },
  {
    closedHan: 2,
    id: "toitoi",
    japanese: "対々和",
    name: "All triplets",
    openHan: 2,
    requirement: "Four triplets or quads and a pair, with no runs.",
    romanized: "Toitoi",
  },
  {
    closedHan: 2,
    id: "sanankou",
    japanese: "三暗刻",
    name: "Three concealed triplets",
    openHan: 2,
    requirement: "Three triplets completed without calling.",
    romanized: "San'ankou",
  },
  {
    closedHan: 2,
    id: "sanshoku-doukou",
    japanese: "三色同刻",
    name: "Mixed triplets",
    openHan: 2,
    requirement: "The same number as a triplet in all three suits.",
    romanized: "Sanshoku doukou",
  },
  {
    closedHan: 2,
    id: "sankantsu",
    japanese: "三槓子",
    name: "Three quads",
    openHan: 2,
    requirement: "Three quads in one hand.",
    romanized: "Sankantsu",
  },
  {
    closedHan: 2,
    id: "shousangen",
    japanese: "小三元",
    name: "Little dragons",
    openHan: 2,
    requirement: "Triplets of two dragons and a pair of the third.",
    romanized: "Shousangen",
  },
  {
    closedHan: 2,
    id: "honroutou",
    japanese: "混老頭",
    name: "Common terminals",
    openHan: 2,
    requirement: "Nothing but terminals and honours.",
    romanized: "Honroutou",
  },
  {
    closedHan: 3,
    id: "honitsu",
    japanese: "混一色",
    name: "Common flush",
    openHan: 2,
    requirement: "One suit plus honours, and nothing else.",
    romanized: "Hon'itsu",
  },
  {
    closedHan: 6,
    id: "chinitsu",
    japanese: "清一色",
    name: "Perfect flush",
    openHan: 5,
    requirement: "One suit and nothing else, not even honours.",
    romanized: "Chin'itsu",
  },
  {
    closedHan: 5,
    id: "renhou",
    japanese: "人和",
    name: "Blessing of man",
    openHan: null,
    requirement: "Winning on a discard before your first draw. Paid as a mangan here.",
    romanized: "Renhou",
  },
];

export const yakumanCatalog: readonly YakumanReference[] = [
  {
    doubleWhen: null,
    id: "tenhou",
    japanese: "天和",
    name: "Blessing of heaven",
    requirement: "The dealer's opening fourteen tiles are already a winning hand.",
    romanized: "Tenhou",
  },
  {
    doubleWhen: null,
    id: "chiihou",
    japanese: "地和",
    name: "Blessing of earth",
    requirement: "A non-dealer wins on their first draw, with no call before it.",
    romanized: "Chiihou",
  },
  {
    doubleWhen: "Waiting on all thirteen tiles.",
    id: "kokushi-musou",
    japanese: "国士無双",
    name: "Thirteen orphans",
    requirement: "One of each terminal and honour, and a second copy of any one of them.",
    romanized: "Kokushi musou",
  },
  {
    doubleWhen: "Waiting on all nine tiles.",
    id: "chuuren-poutou",
    japanese: "九蓮宝燈",
    name: "Nine gates",
    requirement: "1112345678999 in one suit, closed, plus any tile of that suit.",
    romanized: "Chuuren poutou",
  },
  {
    doubleWhen: "Completed on the pair.",
    id: "suuankou",
    japanese: "四暗刻",
    name: "Four concealed triplets",
    requirement: "Four triplets, none of them called or completed by ron.",
    romanized: "Suuankou",
  },
  {
    doubleWhen: null,
    id: "suukantsu",
    japanese: "四槓子",
    name: "Four quads",
    requirement: "All four quads in one hand.",
    romanized: "Suukantsu",
  },
  {
    doubleWhen: null,
    id: "daisangen",
    japanese: "大三元",
    name: "Big dragons",
    requirement: "Triplets of all three dragons.",
    romanized: "Daisangen",
  },
  {
    doubleWhen: null,
    id: "shousuushii",
    japanese: "小四喜",
    name: "Little winds",
    requirement: "Triplets of three winds and a pair of the fourth.",
    romanized: "Shousuushii",
  },
  {
    doubleWhen: "Under a ruleset that pays it double.",
    id: "daisuushii",
    japanese: "大四喜",
    name: "Big winds",
    requirement: "Triplets of all four winds.",
    romanized: "Daisuushii",
  },
  {
    doubleWhen: null,
    id: "tsuuiisou",
    japanese: "字一色",
    name: "All honours",
    requirement: "Winds and dragons only.",
    romanized: "Tsuuiisou",
  },
  {
    doubleWhen: null,
    id: "chinroutou",
    japanese: "清老頭",
    name: "Perfect terminals",
    requirement: "Ones and nines only.",
    romanized: "Chinroutou",
  },
  {
    doubleWhen: null,
    id: "ryuuiisou",
    japanese: "緑一色",
    name: "All green",
    requirement: "Only 2, 3, 4, 6, 8 of bamboo and the green dragon.",
    romanized: "Ryuuiisou",
  },
];

const yakuById = new Map(yakuCatalog.map((entry) => [entry.id, entry]));
const yakumanById = new Map(yakumanCatalog.map((entry) => [entry.id, entry]));

/**
 * Throws rather than returning a fallback: an id the catalogue has never heard
 * of is a yaku that would score without appearing in the reference, which is a
 * programmer error and not a hand anyone can play their way into.
 */
export function yakuReference(id: string): YakuReference {
  const entry = yakuById.get(id);
  if (entry === undefined) {
    throw new Error(`No catalogue entry for yaku ${id}.`);
  }
  return entry;
}

export function yakumanReference(id: string): YakumanReference {
  const entry = yakumanById.get(id);
  if (entry === undefined) {
    throw new Error(`No catalogue entry for yakuman ${id}.`);
  }
  return entry;
}
