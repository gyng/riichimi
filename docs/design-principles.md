# Product design principles

## Experience thesis

Richii should feel like a calm scoring assistant placed beside the table, not an accounting form. Its visual language is a modern Japanese scoring ledger: warm paper, sumi ink, restrained vermilion, clear grid rhythm, and tile-like geometry.

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
