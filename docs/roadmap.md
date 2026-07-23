# Riichimi roadmap

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
- **Mobile-first pass.** Measured at 390px across every route: the bar stays on
  one row, interactive targets meet the 48px minimum, and no route scrolls
  horizontally. The tile face is the one documented exception.
- **Scoring rules profiles.** Tenhou, EMA, M.League, and JPML A ship beside the
  WRC profiles, each citing a primary source. Required real engine work, not
  data: counted-limit capping, yakuman stacking and caps, optional ura-dora, and
  a profile-controlled double-wind pair fu. Mahjong Soul is deliberately held —
  see [rules profiles](rules-profiles.md) for why, and for what is not modelled.
- **House rule editor.** A table can state its own rules (red fives, kuitan,
  round-up mangan, ura-dora, counted limit, yakuman stacking, double-wind fu) as
  a named local profile beside the published ones. Stored rules are parsed as
  untrusted input, and editing is blocked while a table is pinned to them so a
  hand already scored cannot be re-valued underneath the table.
- **Win announcer.** `announceWin` produces structured announcement data, a
  narrow `SpeechPort` carries the device capability (Web Speech today, native
  reporting unavailable), and an opt-in per-device toggle speaks the result
  without gating scoring.

## Planned

### 1. Internationalisation, especially CJK

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
