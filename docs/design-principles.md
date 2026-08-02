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
- **Type scales with the reader.** Every `font-size`, `line-height`, and
  `letter-spacing` is in `rem`, so raising the browser's default font size raises
  the interface's. Written in px — as all 261 of them were until 2026-08-02 — the
  request did nothing: a reader who asked for 200% type got the same 9px labels.
  Zoom is not a substitute, because it magnifies the layout rather than the text
  and is not the control a phone offers.
- Screen-reader testing
- Reduced-motion support
- Plain-language error recovery

## Density budget

Riichimi is used at the table, mid-hand, one-handed. Reading costs a turn, and
so does scrolling past explanation to reach a control. Prose that explains what
a screen is for belongs in documentation, not on a play surface.

Measured at 390 by 844 (the reference phone), a route should stay within about
two screens of content, and the surfaces used during a hand should put their
primary control in the first screen:

| Route              | Screens |
| ------------------ | ------- |
| Home               | 1.00    |
| Scan               | 1.00    |
| Folio              | 1.00    |
| Setup              | 1.26    |
| Table              | 1.17    |
| Calculator         | 1.62    |
| Calculator, scored | 2.67    |

Two of those numbers moved on 2026-08-02 and it is worth saying why, because
they moved in opposite directions for opposite reasons.

**Setup was 1.93 and is 1.26.** None of the difference was content. `.card` asked
for `flex: 1 1 320px`, which is a width in Setup's wrapping row and a _height_ in
its column below 700px, so four cards padded themselves out with 685px of
nothing. Stated as `min-width` it means the same thing in a row and nothing in a
column. Screen count is a good regression signal precisely because a bug like
that shows up in it.

**The scored calculator was 2.51 and is 2.67**, and that is an improvement. The
score moved into a dock below the scroll region, which takes about 70px out of
the visible area and so raises the ratio — while removing the scroll that
mattered. The number went up; the distance to the answer went to zero.

That is the limit of a screen count: it measures how much there is, not how far
away the important part is. So it is paired with a rule it cannot express.

**A screen's outcome is never behind a scroll.** The calculator's inputs run past
two screens, so a score rendered after them arrived below the fold at the moment
it was produced — the one number the screen exists for, off screen. Scrolling to
it fixes that once and breaks again as soon as a player scrolls back up to change
a tile. The answer is docked at the bottom instead, where it also puts the
primary control in thumb reach; the audit keeps the reasoning and the dock links
to it. A control and its consequence belong in the same place.

Four more rules keep the counts where they are:

- **Setup is not play.** Rules and house rules live on Setup. They are chosen
  once, so keeping them beside the tile picker only costs scrolling. Language is
  the exception and sits in the bar as well: every other setting can wait behind a
  link, but a reader who cannot read the interface cannot read the link either. The
  bar switches it; Setup still explains it.
- **Rare context folds away.** Seat, round, riichi, honba, and sticks sit behind
  one disclosure; win method stays out because it changes every hand.
- **A suit is one row.** The tile picker sizes tiles to the available width so
  nine ranks fit on a single line. Its label sits above the tiles: beside them it
  took 86px of width and wrapped every suit onto three lines.
- **Width earns columns.** Past 700 logical pixels the play surfaces go
  two-column instead of running a single column down a short screen.
- **A short screen sits low.** Home is four rows in an 844px window. Aligned to
  the top it put every control in the upper third, which is the part of a phone a
  thumb reaches last; the title stays at the top and the controls drop to the
  bottom, so the space between them reads as margin rather than as a page that
  stopped early. Desktop keeps the block at the top, where a wide screen expects
  it.

No route may scroll horizontally at that width. The bar's destinations are the one
row allowed to scroll on their own: with a language and Setup beside them, English
labels stop fitting somewhere below 390px, and a row that swipes costs a swipe
while a row that wraps costs a second bar's height before any content. Its
trailing edge fades so the clip reads as more row rather than a broken word.

Both are cheap to re-measure in the browser, and a regression shows up as a screen
count rather than an opinion.
