# ADR 0004: Event-sourced session log

- Status: accepted
- Date: 2026-07-24

## Context

A table session must let a player correct a completed round without restarting the game, and scores must never change silently — every recompute has to be auditable and reversible. The original session model stored only a derived `TableState` plus an untrimmed stack of prior `TableState` snapshots. That representation cannot reproduce scores from `history` alone: riichi declarations leave no history record, and the riichi-stick payout, honba bonus, and dealer/non-dealer tsumo split are baked into each stored payment rather than recomputed. Editing a mid-session round therefore had no faithful, verifiable basis.

The full design is `docs/design/editable-completed-rounds.md`. This ADR records the durable model and policy decisions; the edit operations themselves land in a later phase.

## Decision

Model a session as an event log folded over an immutable base snapshot:

- `SessionState` is `{ base: TableState, events: SessionEvent[], table: TableState, undoStack: SessionEvent[][] }`. `base` is a verbatim starting snapshot, `events` are the recorded inputs (riichi, win, draw), and `table` is a derived cache with the invariant `table == replaySessionEvents(base, events).table`.
- Events store inputs only — never derived outcomes. `deltas`, `honba`, `roundWind`, and `handNumber` are recomputed on replay, so an untouched log replays byte-for-byte to the same `history`.
- Replay returns typed failures for untrusted (stored or edited) logs; the live reducers keep their thrown-error guards for programmer errors and advance `table` incrementally on the hot path.
- `undoStack` holds prior event logs, most recent last. Undo pops one entry and replays it. This is uniform across append and (future) edit actions, and array-prefix sharing keeps it cheap in memory.

Persistence and migration:

- The stored document is `StoredSessionV2` (`riichimi.session.v2`): `{ base, events, undoStack, schemaVersion: 2 }`. `table` is not persisted as truth — replay on load rebuilds it and doubles as an integrity check.
- Load order is v2, then the legacy `riichimi.session.v1` document. The v1 key is retained until the first successful v2 save, so a migration defect can never destroy the original data.
- A true v1 session (`{ table, undoStack: TableState[] }`, no `base`/`events`) migrates via `reconstructSessionFromSnapshots`, which diffs the complete, untrimmed snapshot trace to recover each action — including riichi declarations, which are otherwise invisible. Reconstruction is **verified** by replay-equality against the final snapshot. A verifiable trace becomes an editable event log; an unverifiable one degrades to a lossless read-only baseline (`base` = the final snapshot, `events` empty) with scores and history intact but pre-existing rounds not editable.
- Migrated riichi events get synthesized ids (`riichi-migrated-<n>`) and borrow the following round's timestamp — an approximate, display-only value, since a v1 riichi recorded none of its own.
- The **persisted** `undoStack` is capped at the 50 most recent entries; the in-memory stack stays unbounded. Worst-case JSON stays comfortably inside browser storage limits.

Two deliberate policy choices:

- **Warn, never auto-adjust.** When an edit shifts a later round's honba or a tsumo winner's dealer status, that round's stored payment is stale (its han/fu are not stored and honba may have been overridden manually). Replay stays verbatim and surfaces a blocking warning naming the round to re-enter, rather than silently recomputing a value it cannot reconstruct.
- **No redo.** The app has never had redo, and adding it now would expand surface without a driving need. The log-stack representation makes a `redoStack` a trivial additive change later.

## Consequences

Sessions — fresh, well-migrated legacy, and fallback-restored — share one uniform shape, and replay is a single deterministic source of truth for scores and for load-time integrity. Virtually all real legacy sessions take the verified migration path because their v1 undo trace was complete. The cost is an O(events) replay on undo, load, and (future) edit; appends remain incremental. Honba-aware payments that would turn stale-payment warnings into automatic fixes remain a clean, additive future enhancement.
