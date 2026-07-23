# Scoring rules profiles

Last reviewed: **2026-07-23**

Richii stores one profile preference per device and pins that profile into a table when East 1 starts. A running table keeps the same profile through reload and undo; ending the table is required before switching profiles. Old stored tables migrate to WRC 2025.

## World Riichi Rules 2025

The baseline profile follows the options represented by Richii's versioned [WRC 2025 reference](https://www.worldriichi.org/wrc-rules): open tanyao, kiriage mangan, kazoe capped at yakuman, double yakuman, renhou as mangan, and no red fives.

## WRC 2025 · red-five table

This is an explicit **Richii local profile**, not a separately published WRC ruleset. It preserves every baseline WRC 2025 option and changes exactly one policy: the three red fives are enabled and count as dora. The UI labels this difference beside the selector so a table cannot accidentally imply official WRC red-five rules.

Both profiles use the same deterministic scoring pipeline. Profile data—not UI branches—controls tile availability, red-dora counting, score-history attribution, WebMCP state, and table pinning.
