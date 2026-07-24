# Scoring rules profiles

Last reviewed: **2026-07-24**

Riichimi stores one profile preference per device and pins that profile into a table when East 1 starts. A running table keeps the same profile through reload and undo; ending the table is required before switching profiles. Old stored tables migrate to WRC 2025.

Every profile uses the same deterministic scoring pipeline. Profile data—not UI branches—controls tile availability, red-dora counting, fu, limits, score-history attribution, WebMCP state, and table pinning. The selector summarises each profile from that same data, so the description cannot drift from what the scorer does.

## What a profile controls

| Option               | Meaning                                                             |
| -------------------- | ------------------------------------------------------------------- |
| `redFives`           | The three red fives exist and count as dora                         |
| `allowOpenTanyao`    | Tanyao may be claimed with an open hand (kuitan)                    |
| `kiriageMangan`      | 4 han 30 fu and 3 han 60 fu round up to mangan                      |
| `countedLimit`       | 13+ han pays a counted yakuman (`yonbaiman`) or caps at `sanbaiman` |
| `yakumanStacking`    | Combined yakuman are `additive`, or a hand pays a `single` yakuman  |
| `maxYakumanMultiple` | Highest multiple payable when yakuman combine                       |
| `uraDora`            | Ura-dora indicators count for a riichi hand                         |
| `doubleWindPairFu`   | Fu for a pair that is both the seat wind and the round wind         |

## Profiles

### World Riichi Rules 2025

The baseline, following the options in the versioned [WRC 2025 reference](https://www.worldriichi.org/wrc-rules): open tanyao, kiriage mangan, kazoe capped at yakuman, and no red fives.

### WRC 2025 · red-five table

An explicit **Riichimi local profile**, not a separately published WRC ruleset. It preserves every baseline WRC 2025 option and changes exactly one policy: the three red fives are enabled and count as dora. The UI labels this difference so a table cannot accidentally imply official WRC red-five rules.

### Tenhou · ranked

The 段位戦 configuration the Houou lobby plays (喰赤). Red fives, open tanyao, **no** round-up mangan, kazoe yakuman at 13+ han, and a 4-fu double-wind pair. Source: [tenhou.net/man](https://tenhou.net/man/).

### EMA Riichi 2016

The European Mahjong Association competition rules, distinctive on two axes: **no kazoe yakuman** — 13+ han is scored as a sanbaiman — and **yakuman that never combine** ("Yakuman are not cumulative"). No red fives. Source: [Riichi rules 2016 (PDF)](https://mahjong-europe.org/portal/images/docs/Riichi-rules-2016-EN.pdf).

The double-wind pair is an interpretation: the rulebook lists seat-wind and round-wind pairs as separate 2-fu entries and never states a combined value, so a pair that is both is read literally as 2 + 2.

### M.League

The only shipped profile besides WRC with **round-up mangan**, and it caps a counted hand at sanbaiman rather than paying a kazoe yakuman. Red fives, open tanyao, 2-fu double-wind pair. Source: [m-league.jp/about](https://m-league.jp/about/).

### JPML A-rule

The Japan Professional Mahjong League competition rules. The only shipped profile that plays **without ura-dora**, and without red fives. Counts 13+ han as yonbaiman and caps combined yakuman at four. Source: [ma-jan.or.jp](https://www.ma-jan.or.jp/activity/game_rule.html).

## Deliberate omissions

Two kinds of rule are **not** encoded, because encoding them would imply a precision we do not have.

**Not a hand score.** Nagashi mangan, uma and oka, placement bonuses, chombo, head-bump versus multiple ron, and abortive draws decide table outcomes rather than the value of a scored hand, which is what `scoreHand` computes. Kan dora is likewise a table procedure: the scorer counts whichever indicators the user enters.

**Not yet confirmed.** Mahjong Soul is deliberately **absent**. Its published ranked-rules page does not state round-up mangan or kazoe handling, so a profile would have to guess two options. It waits for primary sources.

## Single-yaku double yakuman

The engine detects the single-yaku double yakuman — **13-wait kokushi, suuankou tanki, junsei chuuren, and daisuushii** — and pays them double when a ruleset's `doubleYakuman` flag is on. It is **off in every shipped competition profile**, because they score these as one yakuman:

- **Tenhou** states it directly: 「役満は複合あり、四暗刻単騎・国士無双十三面待ち等はすべてシングル役満」 — four-concealed single-wait, 13-wait kokushi, etc. are all single yakuman ([tenhou.net/man](https://tenhou.net/man/)).
- **EMA** does not stack yakuman at all ("Yakuman are not cumulative").
- WRC, M.League, and JPML leave it off absent a primary source that says otherwise — the safe default never over-pays.

The behavior belongs to Mahjong Soul and many casual tables, so it is a **House Rules toggle** ("Single-yaku double yakuman") rather than a claim baked into any official profile.

Rules a profile cannot yet express — JPML playing without ippatsu, for instance — are left out rather than approximated.
