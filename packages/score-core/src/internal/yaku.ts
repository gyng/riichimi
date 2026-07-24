import type { StandardGroup } from "../domain/meld";
import type { DoraBreakdown, Yaku, Yakuman } from "../domain/score";
import {
  canonicalizeTile,
  isDragon,
  isHonor,
  isInside,
  isTerminal,
  isTerminalOrHonor,
  isWind,
  suitedTile,
  tileRank,
  tileSuit,
} from "../domain/tile";
import type { CanonicalTileId, Dragon, Wind } from "../domain/tile";
import type { StandardInterpretation } from "./hand-analysis";
import type { NormalizedHand } from "./normalize-hand";

const dragons: readonly Dragon[] = ["white", "green", "red"];
const winds: readonly Wind[] = ["east", "south", "west", "north"];

// The Japanese name in kanji for each yaku, keyed by id so the display and the
// announcer can lead with it. Dragon and wind value-honour ids resolve to the
// specific tile (白/發/中, 自風/場風). A missing id falls back to the English name.
const JAPANESE: Readonly<Record<string, string>> = {
  riichi: "立直",
  "double-riichi": "ダブル立直",
  ippatsu: "一発",
  "menzen-tsumo": "門前清自摸和",
  pinfu: "平和",
  tanyao: "断幺九",
  iipeikou: "一盃口",
  "yakuhai-white": "白",
  "yakuhai-green": "發",
  "yakuhai-red": "中",
  "yakuhai-seat": "自風",
  "yakuhai-round": "場風",
  haitei: "海底摸月",
  houtei: "河底撈魚",
  rinshan: "嶺上開花",
  chankan: "槍槓",
  "sanshoku-doujun": "三色同順",
  ittsuu: "一気通貫",
  chanta: "混全帯幺九",
  chiitoitsu: "七対子",
  toitoi: "対々和",
  sanankou: "三暗刻",
  "sanshoku-doukou": "三色同刻",
  sankantsu: "三槓子",
  shousangen: "小三元",
  honroutou: "混老頭",
  junchan: "純全帯幺九",
  honitsu: "混一色",
  chinitsu: "清一色",
  ryanpeikou: "二盃口",
  renhou: "人和",
  "kokushi-musou": "国士無双",
  suuankou: "四暗刻",
  daisangen: "大三元",
  shousuushii: "小四喜",
  daisuushii: "大四喜",
  tsuuiisou: "字一色",
  chinroutou: "清老頭",
  ryuuiisou: "緑一色",
  "chuuren-poutou": "九蓮宝燈",
  suukantsu: "四槓子",
  tenhou: "天和",
  chiihou: "地和",
};

function yaku(id: string, name: string, romanized: string, han: number): Yaku {
  return { han, id, japanese: JAPANESE[id] ?? name, name, romanized };
}

function yakuman(id: string, name: string, romanized: string, value: 1 | 2 = 1): Yakuman {
  return { id, japanese: JAPANESE[id] ?? name, name, romanized, value };
}

function isTripletLike(
  group: StandardGroup,
): group is Extract<StandardGroup, { readonly kind: "quad" | "triplet" }> {
  return group.kind === "triplet" || group.kind === "quad";
}

function sequenceKey(group: Extract<StandardGroup, { readonly kind: "sequence" }>): string {
  return group.tiles.join("");
}

function sequenceStarts(groups: readonly StandardGroup[]): ReadonlySet<string> {
  return new Set(
    groups.flatMap((group) => {
      if (group.kind !== "sequence") {
        return [];
      }

      const suit = tileSuit(group.tiles[0]);
      const rank = tileRank(group.tiles[0]);
      return suit === null || rank === null ? [] : [`${rank}${suit}`];
    }),
  );
}

function hasFullStraight(groups: readonly StandardGroup[]): boolean {
  const starts = sequenceStarts(groups);
  return (["m", "p", "s"] as const).some(
    (suit) => starts.has(`1${suit}`) && starts.has(`4${suit}`) && starts.has(`7${suit}`),
  );
}

function hasMixedSequences(groups: readonly StandardGroup[]): boolean {
  const starts = sequenceStarts(groups);
  return [1, 2, 3, 4, 5, 6, 7].some(
    (rank) => starts.has(`${rank}m`) && starts.has(`${rank}p`) && starts.has(`${rank}s`),
  );
}

function hasMixedTriplets(groups: readonly StandardGroup[]): boolean {
  const triplets = new Set(
    groups.flatMap((group) => {
      if (!isTripletLike(group)) {
        return [];
      }

      const suit = tileSuit(group.tile);
      const rank = tileRank(group.tile);
      return suit === null || rank === null ? [] : [`${rank}${suit}`];
    }),
  );

  return [1, 2, 3, 4, 5, 6, 7, 8, 9].some(
    (rank) => triplets.has(`${rank}m`) && triplets.has(`${rank}p`) && triplets.has(`${rank}s`),
  );
}

function groupHasTerminalOrHonor(group: StandardGroup): boolean {
  return group.kind === "sequence" ? group.tiles.some(isTerminal) : isTerminalOrHonor(group.tile);
}

function valuePair(pair: CanonicalTileId, hand: NormalizedHand): boolean {
  return isDragon(pair) || pair === hand.context.seatWind || pair === hand.context.roundWind;
}

function concealedTripletCount(
  hand: NormalizedHand,
  interpretation: StandardInterpretation,
): number {
  const completedGroupIndex =
    interpretation.placement.concealedGroupIndex === null
      ? null
      : hand.melds.length + interpretation.placement.concealedGroupIndex;

  return interpretation.groups.filter((group, groupIndex) => {
    if (!isTripletLike(group) || group.open) {
      return false;
    }

    return !(
      hand.context.method === "ron" &&
      group.kind === "triplet" &&
      groupIndex === completedGroupIndex
    );
  }).length;
}

function commonYaku(hand: NormalizedHand): Yaku[] {
  const result: Yaku[] = [];

  if (hand.context.riichi === "double-riichi") {
    result.push(yaku("double-riichi", "Double riichi", "Daburu riichi", 2));
  } else if (hand.context.riichi === "riichi") {
    result.push(yaku("riichi", "Riichi", "Riichi", 1));
  }

  if (hand.context.ippatsu) {
    result.push(yaku("ippatsu", "Unbroken", "Ippatsu", 1));
  }

  if (hand.isClosed && hand.context.method === "tsumo") {
    result.push(yaku("menzen-tsumo", "Fully concealed hand", "Menzen tsumo", 1));
  }

  if (hand.context.chankan) {
    result.push(yaku("chankan", "Robbing a quad", "Chankan", 1));
  }

  if (hand.context.rinshan) {
    result.push(yaku("rinshan", "After a quad", "Rinshan kaihou", 1));
  }

  if (hand.context.lastTile === "haitei") {
    result.push(yaku("haitei", "Last tile draw", "Haitei", 1));
  } else if (hand.context.lastTile === "houtei") {
    result.push(yaku("houtei", "Last tile claim", "Houtei", 1));
  }

  return result;
}

function addTileCompositionYaku(hand: NormalizedHand, result: Yaku[]): void {
  const allInside = hand.allHandTiles.every(isInside);

  if (allInside && (hand.isClosed || hand.rules.allowOpenTanyao)) {
    result.push(yaku("tanyao", "All inside", "Tan'yao", 1));
  }

  const suits = new Set(hand.allHandTiles.map(tileSuit).filter((suit) => suit !== null));
  const hasHonours = hand.allHandTiles.some(isHonor);

  if (suits.size === 1 && hasHonours) {
    result.push(yaku("honitsu", "Common flush", "Hon'itsu", hand.isClosed ? 3 : 2));
  } else if (suits.size === 1 && !hasHonours) {
    result.push(yaku("chinitsu", "Perfect flush", "Chin'itsu", hand.isClosed ? 6 : 5));
  }

  const allTerminalsAndHonours = hand.allHandTiles.every(isTerminalOrHonor);
  const hasTerminal = hand.allHandTiles.some(isTerminal);

  if (allTerminalsAndHonours && hasHonours && hasTerminal) {
    result.push(yaku("honroutou", "Common terminals", "Honroutou", 2));
  }
}

export function evaluateSevenPairsYaku(hand: NormalizedHand): readonly Yaku[] {
  const result = commonYaku(hand);
  result.push(yaku("chiitoitsu", "Seven pairs", "Chiitoitsu", 2));
  addTileCompositionYaku(hand, result);
  return result;
}

export function evaluateStandardYaku(
  hand: NormalizedHand,
  interpretation: StandardInterpretation,
): readonly Yaku[] {
  const result = commonYaku(hand);
  const { groups } = interpretation;
  const pair = interpretation.decomposition.pair;
  const sequences = groups.filter(
    (group): group is Extract<StandardGroup, { readonly kind: "sequence" }> =>
      group.kind === "sequence",
  );
  const triplets = groups.filter(isTripletLike);

  if (
    hand.isClosed &&
    sequences.length === 4 &&
    !valuePair(pair, hand) &&
    interpretation.placement.wait === "ryanmen"
  ) {
    result.push(yaku("pinfu", "Pinfu", "Pinfu", 1));
  }

  if (hand.isClosed) {
    const identicalSequenceCounts = new Map<string, number>();

    for (const sequence of sequences) {
      const key = sequenceKey(sequence);
      identicalSequenceCounts.set(key, (identicalSequenceCounts.get(key) ?? 0) + 1);
    }

    const twinSequencePairs = [...identicalSequenceCounts.values()].reduce(
      (total, count) => total + Math.floor(count / 2),
      0,
    );

    if (twinSequencePairs >= 2) {
      result.push(yaku("ryanpeikou", "Double twin sequences", "Ryanpeikou", 3));
    } else if (twinSequencePairs === 1) {
      result.push(yaku("iipeikou", "Twin sequences", "Iipeikou", 1));
    }
  }

  addTileCompositionYaku(hand, result);

  for (const group of triplets) {
    if (isDragon(group.tile)) {
      result.push(yaku(`yakuhai-${group.tile}`, `Value honour: ${group.tile}`, "Yakuhai", 1));
    }

    if (group.tile === hand.context.seatWind) {
      result.push(yaku("yakuhai-seat", "Value honour: seat wind", "Yakuhai", 1));
    }

    if (group.tile === hand.context.roundWind) {
      result.push(yaku("yakuhai-round", "Value honour: round wind", "Yakuhai", 1));
    }
  }

  if (hasFullStraight(groups)) {
    result.push(yaku("ittsuu", "Full straight", "Ikkitsuukan", hand.isClosed ? 2 : 1));
  }

  if (hasMixedSequences(groups)) {
    result.push(
      yaku("sanshoku-doujun", "Mixed sequences", "Sanshoku doujun", hand.isClosed ? 2 : 1),
    );
  }

  if (hasMixedTriplets(groups)) {
    result.push(yaku("sanshoku-doukou", "Mixed triplets", "Sanshoku doukou", 2));
  }

  if (triplets.length === 4) {
    result.push(yaku("toitoi", "All triplets", "Toitoi", 2));
  }

  if (concealedTripletCount(hand, interpretation) >= 3) {
    result.push(yaku("sanankou", "Three concealed triplets", "San'ankou", 2));
  }

  if (groups.filter(({ kind }) => kind === "quad").length >= 3) {
    result.push(yaku("sankantsu", "Three quads", "Sankantsu", 2));
  }

  const groupsUseEnds = groups.every(groupHasTerminalOrHonor);
  const pairUsesEnd = isTerminalOrHonor(pair);
  const hasSequence = sequences.length > 0;
  const hasHonour = hand.allHandTiles.some(isHonor);

  if (groupsUseEnds && pairUsesEnd && hasSequence) {
    if (hasHonour) {
      result.push(yaku("chanta", "Common ends", "Chanta", hand.isClosed ? 2 : 1));
    } else {
      result.push(yaku("junchan", "Perfect ends", "Junchan", hand.isClosed ? 3 : 2));
    }
  }

  const dragonTriplets = triplets.filter(({ tile }) => isDragon(tile)).length;

  if (dragonTriplets === 2 && isDragon(pair)) {
    result.push(yaku("shousangen", "Little dragons", "Shousangen", 2));
  }

  return result;
}

function hasNineGates(hand: NormalizedHand): boolean {
  if (!hand.isClosed || hand.melds.length > 0 || hand.allHandTiles.some(isHonor)) {
    return false;
  }

  const suit = tileSuit(hand.allHandTiles[0] ?? "east");

  if (suit === null || hand.allHandTiles.some((tile) => tileSuit(tile) !== suit)) {
    return false;
  }

  const counts = new Map<number, number>();

  for (const tile of hand.allHandTiles) {
    const rank = tileRank(tile);

    if (rank !== null) {
      counts.set(rank, (counts.get(rank) ?? 0) + 1);
    }
  }

  return (
    hand.allHandTiles.length === 14 &&
    (counts.get(1) ?? 0) >= 3 &&
    (counts.get(9) ?? 0) >= 3 &&
    [2, 3, 4, 5, 6, 7, 8].every((rank) => (counts.get(rank) ?? 0) >= 1)
  );
}

// The pure 13-sided wait: all thirteen orphans were held and the winning tile
// completed the pair, so it is the one tile now appearing twice.
function isThirteenOrphanWait(hand: NormalizedHand): boolean {
  return hand.allHandTiles.filter((tile) => tile === hand.winningTile).length === 2;
}

// Junsei chuuren: the pure 1112345678999 shape was held and won on any tile, so
// removing the winning tile leaves exactly that shape.
function isPureNineGates(hand: NormalizedHand): boolean {
  const winningRank = tileRank(hand.winningTile);

  if (winningRank === null) {
    return false;
  }

  const counts = new Map<number, number>();

  for (const tile of hand.allHandTiles) {
    const rank = tileRank(tile);

    if (rank !== null) {
      counts.set(rank, (counts.get(rank) ?? 0) + 1);
    }
  }

  counts.set(winningRank, (counts.get(winningRank) ?? 0) - 1);

  return [1, 2, 3, 4, 5, 6, 7, 8, 9].every(
    (rank) => (counts.get(rank) ?? 0) === (rank === 1 || rank === 9 ? 3 : 1),
  );
}

export function evaluateYakuman(
  hand: NormalizedHand,
  interpretation: StandardInterpretation | null,
  thirteenOrphans: boolean,
  doubleYakuman: boolean,
): readonly Yakuman[] {
  const result: Yakuman[] = [];

  if (hand.context.firstTurn === "tenhou") {
    result.push(yakuman("tenhou", "Blessing of heaven", "Tenhou"));
  } else if (hand.context.firstTurn === "chiihou") {
    result.push(yakuman("chiihou", "Blessing of earth", "Chiihou"));
  }

  if (thirteenOrphans) {
    const value = doubleYakuman && isThirteenOrphanWait(hand) ? 2 : 1;
    result.push(yakuman("kokushi-musou", "Thirteen orphans", "Kokushi musou", value));
  }

  if (hasNineGates(hand)) {
    const value = doubleYakuman && isPureNineGates(hand) ? 2 : 1;
    result.push(yakuman("chuuren-poutou", "Nine gates", "Chuuren poutou", value));
  }

  const greenTiles = new Set<CanonicalTileId>(["2s", "3s", "4s", "6s", "8s", "green"]);

  if (hand.allHandTiles.every((tile) => greenTiles.has(tile))) {
    result.push(yakuman("ryuuiisou", "All green", "Ryuuiisou"));
  }

  if (hand.allHandTiles.every(isTerminal)) {
    result.push(yakuman("chinroutou", "Perfect terminals", "Chinroutou"));
  }

  if (hand.allHandTiles.every(isHonor)) {
    result.push(yakuman("tsuuiisou", "All honours", "Tsuuiisou"));
  }

  if (interpretation !== null) {
    const triplets = interpretation.groups.filter(isTripletLike);
    const concealedTriplets = concealedTripletCount(hand, interpretation);
    const dragonTriplets = triplets.filter(({ tile }) => isDragon(tile)).length;
    const windTriplets = triplets.filter(({ tile }) => isWind(tile)).length;

    if (
      triplets.length === 4 &&
      concealedTriplets === 4 &&
      (hand.context.method === "tsumo" || interpretation.placement.wait === "tanki")
    ) {
      // The single (tanki) wait is what pays double — a shanpon wait completed
      // by tsumo is a normal suuankou.
      const value = doubleYakuman && interpretation.placement.wait === "tanki" ? 2 : 1;
      result.push(yakuman("suuankou", "Four concealed triplets", "Suuankou", value));
    }

    if (interpretation.groups.filter(({ kind }) => kind === "quad").length === 4) {
      result.push(yakuman("suukantsu", "Four quads", "Suukantsu"));
    }

    if (dragonTriplets === 3) {
      result.push(yakuman("daisangen", "Big dragons", "Daisangen"));
    }

    if (windTriplets === 4) {
      result.push(yakuman("daisuushii", "Big winds", "Daisuushii", doubleYakuman ? 2 : 1));
    } else if (windTriplets === 3 && isWind(interpretation.decomposition.pair)) {
      result.push(yakuman("shousuushii", "Little winds", "Shousuushii"));
    }
  }

  return result;
}

function nextDora(indicator: CanonicalTileId): CanonicalTileId {
  const suit = tileSuit(indicator);
  const rank = tileRank(indicator);

  if (suit !== null && rank !== null) {
    return suitedTile(rank === 9 ? 1 : rank + 1, suit) ?? indicator;
  }

  const windIndex = isWind(indicator) ? winds.indexOf(indicator) : -1;

  if (windIndex >= 0) {
    return winds[(windIndex + 1) % winds.length] ?? "east";
  }

  const dragonIndex = isDragon(indicator) ? dragons.indexOf(indicator) : -1;
  return dragons[(dragonIndex + 1) % dragons.length] ?? "white";
}

function indicatorDoraCount(
  handTiles: readonly CanonicalTileId[],
  indicators: readonly CanonicalTileId[],
): number {
  return indicators.reduce((total, indicator) => {
    const dora = nextDora(indicator);
    return total + handTiles.filter((tile) => tile === dora).length;
  }, 0);
}

export function countDora(hand: NormalizedHand): DoraBreakdown {
  const dora = indicatorDoraCount(hand.allHandTiles, hand.doraIndicators);
  // Rulesets that play without ura-dora ignore any revealed indicators.
  const uraDora = hand.rules.uraDora
    ? indicatorDoraCount(hand.allHandTiles, hand.uraDoraIndicators)
    : 0;
  const redDora = hand.rules.redFives
    ? hand.originalHandTiles.filter((tile) => canonicalizeTile(tile) !== tile).length
    : 0;

  return { dora, redDora, total: dora + uraDora + redDora, uraDora };
}

export function renhouYaku(): readonly Yaku[] {
  return [yaku("renhou", "Blessing of man", "Renhou", 5)];
}
