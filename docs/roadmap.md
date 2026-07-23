# Richii roadmap

Last reviewed: **2026-07-24**

This tracks committed-to product work beyond the shipped scope recorded in
[the plan](riichi-score-calculator-plan.md). Items are ordered by the sequence we
intend to build them, not by size.

Status vocabulary: **Shipped** · **In progress** · **Planned** · **Blocked**.

## Shipped

- **Editable completed rounds.** Event-sourced session log with pure replay, a
  preview-before-commit correction flow, and downstream-round warnings. See
  [the design](design/editable-completed-rounds.md) and
  [ADR 0004](decisions/0004-event-sourced-session-log.md).
- **Called meld/kan capture.** The guided recognizer localizes called sets,
  infers their type, and feeds a scoreable draft. See
  [the design](design/guided-meld-capture.md).
- **Two capture layouts + structure confirmation.** A natural single-row layout
  (default) and the guided row layout, with the concealed/called split confirmed
  at the review gate because the natural layout's structure is a guess.
- **Persistent top app bar.** Primary destinations (Scan · Manual · Table ·
  History) in app chrome rather than behind a landing hero; the bar owns the top
  safe-area inset and back navigation.
- **Camera-free review path.** A bundled sample hand runs the real offline
  recognizer, so the scan flow can be reviewed on a desktop with no camera.

## Planned

### 1. Scoring rules profiles for common rulesets

Add Tenhou, Mahjong Soul, EMA, M.League, and JPML A profiles beside the existing
WRC 2025 profiles.

This is the highest-correctness-risk item on the roadmap: a wrong option value
silently produces a wrong score. Two constraints:

- Every profile carries a real, citable `sourceUrl`. No profile ships on
  recalled rules.
- `ScoringRules` currently exposes only `allowOpenTanyao`, `kiriageMangan`,
  `redFives`, plus a fixed `countedLimit` and `doubleYakuman: false`. Real
  variants additionally differ on ura dora, kan dora, nagashi mangan, kazoe
  handling, and double/multiple yakuman. Each new knob is an engine change with
  its own tests, not a data-only addition.

Where a rule cannot be confirmed from an authoritative source, the profile must
not guess: either omit the ruleset or surface the uncertainty. A profile that
looks official but scores wrong is worse than no profile.

### 2. House rule editor

Let a table express local rules directly (red fives, kuitan, kiriage, and the
knobs added in item 1) as a named local profile, clearly distinguished from
published rulesets the way `WRC 2025 · red-five table` already is. Depends on the
knob set from item 1 being settled.

### 3. Mobile-first UI pass

The layout is responsive but was composed desktop-first. Audit the primary flows
on narrow phones, large text, and landscape: capture, review, calculator, table,
and history. Interactive targets at least 48×48, no horizontal scrolling, and
keyboard/screen-reader parity on web.

### 4. Win announcer

Announce the scored result (Mahjong-Soul style) through a **TTS port** so the
implementation is swappable. Start with a Web Speech adapter; leave room for a
local neural voice (Moonshine, Piper) later. Must respect reduced-motion and
sound preferences, be off by default or easily silenced, and never block scoring.

### 5. Internationalisation, especially CJK

Extract user-facing copy behind a translation boundary and verify Japanese and
Chinese rendering: line breaking, font fallback, numeral and honorific handling,
and layout under longer/shorter strings. Domain terminology (han, fu, yakuman)
should stay precise in every locale.

## Recognizer follow-ups

Carried from the model audit; these gate any accuracy claim beyond the current
review-gated beta.

- A representative multi-hand corpus and real-device benchmarks.
- An evaluation harness plus test-time augmentation and confidence calibration.
- Real meld/kan photographs, and natural single-row captures, in that corpus.
