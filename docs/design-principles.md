# Product design principles

## Experience thesis

Riichimi should feel like a calm scoring assistant placed beside the table, not an accounting form. Its visual language is a modern Japanese scoring ledger: warm paper, sumi ink, restrained vermilion, clear grid rhythm, and tile-like geometry.

## Information architecture

The top-level paths follow user goals:

1. Scan a winning hand
2. Enter a hand manually
3. Resume an active table session
4. Review recent results
5. Change rules and preferences

The capture path should remain linear: prepare, capture, review uncertainty, add invisible context, verify score. Advanced rules and rare yaku stay contextual rather than competing with the primary task.

## Cognitive principles

- **Recognition over recall:** show tile faces, current winds, and visible ruleset context.
- **Progressive disclosure:** reveal situational flags only when the hand or event makes them plausible.
- **Error prevention:** detect blur, crop, impossible counts, and ambiguous winning tiles before scoring.
- **Local correction:** put the replacement action beside the uncertain tile.
- **Externalized memory:** persist session state and corrections so users do not repeatedly re-enter facts.
- **Clear system status:** distinguish capturing, recognizing, reviewing, validating, and scoring.
- **Reversible action:** preserve undo for corrections, score transfers, and round advancement.
- **Calibrated trust:** uncertainty changes the interaction; it is never hidden behind a confident-looking result.

## Atomic design

- Tokens encode shared visual decisions.
- Atoms remain independently accessible.
- Molecules complete one small interaction.
- Organisms express a recognizable product section.
- Screens arrange hierarchy, state, and navigation.

Do not split a component solely to satisfy a taxonomy. Split when a concept has a clear responsibility, needs isolated testing, or is reused.

## Accessibility baseline

- WCAG 2.2 AA on web and equivalent native semantics
- Logical focus order and full keyboard operation on web
- Accessible names and states for every control
- Minimum 48 by 48 logical-pixel targets where possible
- No information encoded by color alone
- Large-text and screen-reader testing
- Reduced-motion support
- Plain-language error recovery

## Density budget

Riichimi is used at the table, mid-hand, one-handed. Reading costs a turn, and
so does scrolling past explanation to reach a control. Prose that explains what
a screen is for belongs in documentation, not on a play surface.

Measured at 390 by 844 (the reference phone), a route should stay within about
two screens of content, and the surfaces used during a hand should put their
primary control in the first screen:

| Route      | Screens                                        |
| ---------- | ---------------------------------------------- |
| Home       | 1.0                                            |
| Scan       | 1.0                                            |
| Folio      | 1.0                                            |
| Setup      | 1.0                                            |
| Table      | 1.7                                            |
| Calculator | 1.6 (about 2.0 with a table's winner controls) |

Three rules keep it there:

- **Setup is not play.** Rules, house rules, and language live on Setup. They are
  chosen once, so keeping them beside the tile picker only costs scrolling.
- **Rare context folds away.** Seat, round, riichi, honba, and sticks sit behind
  one disclosure; win method stays out because it changes every hand.
- **A suit is one row.** The tile picker sizes tiles to the available width so
  nine ranks fit on a single line. Its label sits above the tiles: beside them it
  took 86px of width and wrapped every suit onto three lines.

No route may scroll horizontally at that width. Both are cheap to re-measure in
the browser, and a regression shows up as a screen count rather than an opinion.
