# Design: Editable Completed Rounds via an Event-Sourced Session Log

Status: **accepted design, pending implementation**. Authored by a Fable architect
pass and reviewed. Implementation is delegated and gated phase-by-phase on
`npm run check`. The overriding constraint: **scores must never change silently** —
every recompute is auditable, warned about when a stored payment becomes stale,
and reversible via undo.

## Product clarification (honba is a manual, defaulted input)

Not every round arrives through the session event log — the manual calculator is
also used standalone. So **honba (and the rest of the win context: seat/round wind,
riichi sticks) must be a manually-editable field with a sensible default**, never a
value that is only ever auto-derived from the log.

Consequences for this design:

- When re-scoring an edited round (Phase 4b), the calculator seeds honba/sticks/wind
  from `tableBeforeRound(...)` as *defaults* but leaves them **user-editable** — the
  user can correct honba by hand, which is the intended fix for a `stale-honba-payment`
  warning.
- The `stale-honba-payment` / `stale-dealer-payment` warnings (§2.3) stand: they tell
  the user a stored payment was entered for a now-changed context. The resolution is
  re-scoring with the honba field the user sets manually — not silent recomputation.
- Phase 1 is unaffected (it changes no honba handling). This note governs Phases 4b/5
  and any manual-calculator work.

## 0. Diagnosis verification

Confirmed against the current code:

- `declareRiichi` (`packages/session-core/src/application/session.ts`) applies `-1000`
  to the declarer and `riichiSticks + 1`, but appends nothing to `table.history`.
  The only trace of the declaration is the snapshot pushed to `undoStack`.
- `applyWin` folds `table.riichiSticks * 1000` into the winner's delta at apply time.
  Replaying `history` alone therefore cannot reproduce scores: the stick count at each
  win depends on riichi declarations and carried-over sticks from draws, which are not
  in `history`.
- Two further context couplings matter for edits, both in
  `packages/score-core/src/internal/payments.ts`:
  - **Honba bonus is baked into `payments`** (`+ context.honba * 300` for ron,
    `+ honba * 100` per payer for tsumo). The session reducer never adds honba itself;
    it trusts the entered `PaymentBreakdown`.
  - **Dealer/non-dealer tsumo split is baked into `payments`** (`fromDealer: null`
    means dealer winner). `applyWin` maps `fromDealer` onto whoever is
    `table.dealerIndex` at apply time.

  So if an edit shifts a downstream round's honba or dealer, that round's *stored
  payments are stale* — replay cannot silently "fix" them because han/fu/basePoints
  are not stored. The design surfaces this rather than silently corrupting or guessing.
- One crucial migration asset: `undoStack` contains **every prior `TableState`, one
  per action, never trimmed** (`withUndo`). The chronological sequence
  `[...undoStack, table]` is a complete action trace, so riichi declarations in old
  stored sessions are **exactly reconstructible by diffing consecutive snapshots**.
  Migration can be lossless, and verifiably so.
- Persistence: `richii.session.v1` stores raw `JSON.stringify(SessionState)`;
  `stored-session.ts` validates/migrates `rulesProfileId`. The legacy fixture in
  `stored-session.test.ts` shows player ids are *not* always derivable from the table
  id (`player-0` vs `table-1-player-1`) — so migration must never re-derive the base
  via `createSession`; it must keep the initial `TableState` snapshot as the replay base.

## 1. Domain model: events + replay

### 1.1 New types (`packages/session-core/src/domain/session.ts`)

```ts
export interface RiichiEvent {
  readonly id: string;
  readonly kind: "riichi";
  readonly occurredAt: string;
  readonly playerIndex: number;
}

export interface WinEvent {
  readonly discarderIndex: number | null;
  readonly id: string;
  readonly kind: "win";
  readonly occurredAt: string;
  readonly payments: PaymentBreakdown;
  readonly winnerIndex: number;
}

export interface DrawEvent {
  readonly id: string;
  readonly kind: "draw";
  readonly occurredAt: string;
  readonly tenpaiPlayerIndices: readonly number[];
}

export type SessionEvent = DrawEvent | RiichiEvent | WinEvent;
```

Notes:

- `WinEvent`/`DrawEvent` are exactly `WinCommand`/`DrawCommand` plus a `kind`
  discriminant — events store *inputs*, never derived outcomes. `deltas`, `honba`,
  `roundWind`, `handNumber` on `RoundRecord` remain **derived** and are recomputed on
  replay; `RoundRecord` stays as-is (it is the projection the UI renders).
- Riichi events get ids (`newId("riichi")` from the client, as rounds do today) so
  edits can address them.

### 1.2 New `SessionState` shape

```ts
export interface SessionState {
  /** Immutable starting snapshot. history is empty for fresh tables; may be
      non-empty for a legacy session restored without a reconstructible log. */
  readonly base: TableState;
  readonly events: readonly SessionEvent[];
  /** Derived cache; invariant: deep-equals replaySessionEvents(base, events). */
  readonly table: TableState;
  /** Prior event logs, most recent last. Undo = pop + replay. */
  readonly undoStack: readonly (readonly SessionEvent[])[];
}
```

Why `base` is a `TableState` snapshot rather than `createSession` inputs: it makes
fresh sessions, well-migrated legacy sessions, and fallback-restored legacy sessions
**one uniform shape** (fallback = `base` is the current table, `events` empty), and it
sidesteps the player-id derivation hazard noted above. Replay always folds `events`
over `base`.

Why `undoStack` holds event arrays, not `TableState` snapshots: it makes undo uniform
across *append* actions and *edit* actions (an edit rewrites the middle of the log; a
snapshot of the log is the only faithful thing to restore). Entries share structure in
memory (array prefixes for appends), and replay is deterministic, so popping reproduces
the exact prior table.

### 1.3 Replay (`packages/session-core/src/application/session.ts`)

Internal refactor — extract table-level pure appliers from the existing reducers,
preserving the math verbatim (this is a move, not a rewrite; the payment/advance logic
in `applyWin`/`applyDraw`/`declareRiichi` bodies becomes the bodies of these functions):

```ts
function applyRiichiToTable(table: TableState, event: RiichiEvent): TableState;
function applyWinToTable(table: TableState, event: WinEvent): TableState;
function applyDrawToTable(table: TableState, event: DrawEvent): TableState;
function applyEventToTable(table: TableState, event: SessionEvent): TableState;
```

Public replay, with typed failures because stored/edited logs are not trusted to be valid:

```ts
export type ReplayFailure =
  | { readonly eventId: string; readonly kind: "invalid-event"; readonly reason: string }
  | { readonly eventId: string; readonly kind: "riichi-underfunded"; readonly playerIndex: number };

export type ReplayResult =
  | { readonly kind: "replayed"; readonly table: TableState }
  | ReplayFailure;

export function replaySessionEvents(
  base: TableState,
  events: readonly SessionEvent[],
): ReplayResult;
```

Semantics, matching current reducers exactly:

- `riichi`: no-op if already in `declaredRiichiPlayerIndices` (parity with
  `declareRiichi`'s early return); `riichi-underfunded` failure if the player's
  replayed score `< 1000`; otherwise −1000, +1 stick, add to declared set.
- `win`/`draw`: identical math to today, including `riichiSticks * 1000` payout,
  `advanceHand`, honba rules, and clearing `declaredRiichiPlayerIndices`. The produced
  `WinRecord`/`DrawRecord` uses the event's `id`/`occurredAt` and the *replayed*
  context, so an untouched log replays to a byte-identical `history`.
- Shape violations (out-of-range indices, ron with null/self discarder, tsumo with
  discarder) become `invalid-event` results — validated *before* applying, so the
  existing throwing helpers stay throw-for-programmer-error only.

### 1.4 Existing reducers keep their signatures

`createSession`, `declareRiichi`, `applyWin`, `applyDraw`, `undoLastSessionChange` keep
exact signatures and thrown-error behavior (they are the validated live-play path;
their throws are programmer-error guards, per current tests). Internally they become:
validate → build event → `pushEvent(state, event)` where

```ts
function pushEvent(state: SessionState, event: SessionEvent): SessionState {
  // table advances incrementally via applyEventToTable (no O(n) replay on the hot path)
  // undoStack gains the previous events array
}
```

`declareRiichi` must not read the clock (AGENTS.md domain purity). Change it to accept
metadata the same way win/draw commands do:

```ts
export interface RiichiCommand {
  readonly id: string;
  readonly occurredAt: string;
  readonly playerIndex: number;
}
export function declareRiichi(state: SessionState, command: RiichiCommand): SessionState;
```

This is the **one intentional public-signature change** (currently `(state, playerIndex)`).
Callers: only `session-context.tsx` (`declarePlayerRiichi`), which already has
`createRoundCommandMetadata()`. Update the two existing tests that call it positionally.
The no-op-on-repeat behavior is preserved (returns `state` unchanged, no event appended).

`undoLastSessionChange`: pop the last event array; `table` = replay of the popped log
(cannot fail — it succeeded when it was current); empty stack remains a no-op.

## 2. Edit operations (`packages/session-core/src/application/edit-session.ts`)

### 2.1 Hand-segment rule

For a round event at log index `i`, its **hand segment** is the riichi events between
the previous win/draw event (exclusive) and `i` (inclusive of `i`). Riichi events after
the last round event belong to the **current, in-progress hand**.

- **Replace** a round → its segment's riichi events are kept (same hand, corrected outcome).
- **Delete** a round → its segment's riichi events are deleted with it (they were
  declarations *in that hand*; reassigning them to the following hand would be wrong).
  This is a documented decision.

### 2.2 Commands and results

```ts
export type RoundRevision =
  | {
      readonly discarderIndex: number | null;
      readonly kind: "win";
      readonly payments: PaymentBreakdown;
      readonly winnerIndex: number;
    }
  | { readonly kind: "draw"; readonly tenpaiPlayerIndices: readonly number[] };

export type SessionEditCommand =
  | { readonly kind: "delete-round"; readonly roundId: string }
  | { readonly kind: "replace-round"; readonly revision: RoundRevision; readonly roundId: string }
  /** Rewrite the riichi declarations of a completed round's hand, or of the
      current hand when roundId is null. Needs riichi metadata for added events. */
  | {
      readonly kind: "set-hand-riichi";
      readonly declarations: readonly { readonly id: string; readonly occurredAt: string; readonly playerIndex: number }[];
      readonly roundId: string | null;
    };

export type SessionEditError =
  | { readonly kind: "invalid-revision"; readonly reason: string }
  | { readonly kind: "round-not-editable"; readonly roundId: string } // legacy round inside base snapshot
  | { readonly kind: "round-not-found"; readonly roundId: string }
  | { readonly eventId: string; readonly kind: "riichi-underfunded"; readonly playerIndex: number };

export interface RoundContextChange {
  readonly after: { readonly deltas: readonly number[]; readonly handNumber: number; readonly honba: number; readonly roundWind: Wind };
  readonly before: { readonly deltas: readonly number[]; readonly handNumber: number; readonly honba: number; readonly roundWind: Wind };
  readonly roundId: string;
}

export type EditWarning =
  /** A later win's replayed honba differs from before; its entered payment
      embeds the old honba bonus and needs human review. */
  | { readonly afterHonba: number; readonly beforeHonba: number; readonly kind: "stale-honba-payment"; readonly roundId: string }
  /** A later tsumo's winner-is-dealer status flipped; its dealer/non-dealer
      payment split was computed for the old seating. */
  | { readonly kind: "stale-dealer-payment"; readonly roundId: string };

export interface EditReview {
  readonly changedRounds: readonly RoundContextChange[];
  readonly scoreChanges: readonly number[]; // per seat, final(after) − final(before)
  readonly warnings: readonly EditWarning[];
}

export type SessionEditResult =
  | { readonly kind: "edited"; readonly review: EditReview; readonly state: SessionState }
  | { readonly error: SessionEditError; readonly kind: "rejected" };

export function editSessionRound(state: SessionState, command: SessionEditCommand): SessionEditResult;
export function previewSessionEdit(state: SessionState, command: SessionEditCommand): SessionEditResult;
```

`previewSessionEdit` and `editSessionRound` share one implementation (everything is
pure); the only difference is that the caller adopts `state` from `editSessionRound`
(which has the previous log pushed to `undoStack`) and discards it after a preview. UI
flow: preview → confirm → commit.

### 2.3 Algorithm

1. Locate the win/draw event with `roundId` in `state.events`. Missing → `round-not-found`
   (if a record with that id exists in `state.table.history` but not in `events`, it
   lives inside a legacy `base` → `round-not-editable`).
2. Build the candidate log:
   - `replace-round`: swap the event's payload, keeping original `id` and `occurredAt`
     (identity and timestamp are facts about when it was recorded, not what it says).
   - `delete-round`: remove the event and its hand segment's riichi events.
   - `set-hand-riichi`: replace the segment's riichi events with the given declarations
     (order preserved as given; empty array removes all).
3. Statically validate the revision (ron needs distinct discarder, tsumo forbids one,
   indices in range, duplicate riichi declarations rejected) → `invalid-revision`.
4. `replaySessionEvents(base, candidate)`. A `riichi-underfunded` failure → typed
   rejection naming the player and event so the UI can suggest also removing that riichi.
   State is untouched on any rejection.
5. Compute `EditReview` by diffing old vs new replayed `history` (match records by id;
   report rounds whose `handNumber`/`roundWind`/`honba`/`deltas` changed) and old vs new
   final scores. Emit `stale-honba-payment` for any surviving win record whose replayed
   honba changed, and `stale-dealer-payment` for any surviving tsumo record where
   "winner === dealerIndex" flipped.
6. Commit: `{ base, events: candidate, table, undoStack: [...state.undoStack, state.events] }`.

**Why warnings instead of automatic payment correction:** payments cannot be recomputed
(no han/fu stored), and the user may have deliberately overridden honba in the
calculator. Verbatim replay + explicit, blocking-until-acknowledged warnings means
scores are never *silently* wrong — the ledger tells the user exactly which later rounds
need re-entry. Automatic honba adjustment (storing honba-free base payments or
`basePoints` on new `WinEvent`s) is a clean future enhancement (Phase 5) and the event
model leaves room for it additively.

Also export helpers the UI needs:

```ts
export function editableRoundIds(state: SessionState): ReadonlySet<string>;
/** Replayed table context immediately before a round, for seeding the calculator in edit mode. */
export function tableBeforeRound(state: SessionState, roundId: string): TableState | null;
```

### 2.4 Undo/redo coexistence

- Every mutation — append (riichi/win/draw) *and* edit/delete — pushes the previous
  `events` array onto `undoStack`. "Undo last change" therefore uniformly reverts the
  most recent action, including an edit, restoring the exact prior table (deterministic
  replay). This satisfies "destructive actions need undo" without new UI.
- **Redo is explicitly out of scope** (the app has no redo today). The log-stack
  representation makes a `redoStack` trivial to add later; note in the ADR.

## 3. Persistence and migration

### 3.1 Stored shape v2

```ts
interface StoredSessionV2 {
  readonly base: TableState;
  readonly events: readonly SessionEvent[];
  readonly schemaVersion: 2;
  readonly undoStack: readonly (readonly SessionEvent[])[];
}
```

`table` is not persisted — replay on load is the single source of truth (and doubles as
an integrity check). Storage adapters write key `richii.session.v2`. Load order:

1. Read `richii.session.v2`; if present, shape-validate at the boundary (extend
   `stored-session.ts`), reuse the existing `rulesProfileId` migration on `base`, replay,
   return.
2. Else read `richii.session.v1` and migrate (below). Leave the v1 key untouched until
   the first successful v2 save, then remove it — so a migration bug can never destroy
   the original data.

### 3.2 v1 → v2 reconstruction (lossless, verified)

New pure function in session-core (domain logic stays out of the adapter; the adapter
only parses JSON and shape-checks):

```ts
export type SessionReconstruction =
  | { readonly kind: "reconstructed"; readonly state: SessionState }
  /** Trace could not be verified; session is preserved as a baseline snapshot.
      Scores/history intact; pre-existing rounds are not editable. */
  | { readonly kind: "restored-baseline"; readonly state: SessionState };

export function reconstructSessionFromSnapshots(
  snapshots: readonly TableState[], // [...v1.undoStack, v1.table], chronological
): SessionReconstruction;
```

Algorithm:

1. `base = snapshots[0]` (kept verbatim — never re-derived via `createSession`, because
   legacy player ids differ).
2. For each consecutive pair, classify the single action that separates them:
   - `history` grew by one → the new tail record maps directly to a `WinEvent`/`DrawEvent`
     (records already store the command inputs: `payments`, `winnerIndex`,
     `discarderIndex`, `tenpaiPlayerIndices`, `id`, `occurredAt`).
   - `declaredRiichiPlayerIndices` grew by one → `RiichiEvent` for the added index, with
     synthesized `id` (`riichi-migrated-<n>`) and `occurredAt` taken from the next round
     record's `occurredAt` (else `base.startedAt`) — approximate, display-only, documented.
   - Anything else → unclassifiable; go to fallback.
3. **Verification:** `replaySessionEvents(base, events)` must deep-equal `snapshots.at(-1)`
   (players, scores, sticks, honba, dealer, wind, hand, history). Pass → `reconstructed`,
   with `undoStack` rebuilt as event-log prefixes (`events.slice(0, i)` for each prior
   snapshot), preserving cross-restart undo parity.
4. Fallback (`restored-baseline`): `base =` the v1 current `table`, `events = []`,
   `undoStack = []`. Nothing is lost — scores and history render exactly as before — but
   those legacy rounds are not editable and prior undo depth is dropped. `editableRoundIds`
   returns empty, and the UI shows a one-line explanation.

Because v1 `undoStack` is complete and untrimmed, virtually all real sessions take the
verified path.

Persisted `undoStack` size: cap the *persisted* stack at the most recent 50 entries
(in-memory stays unbounded, as today). Worst-case JSON stays comfortably inside
localStorage limits; decision recorded in the ADR.

Record an ADR: `docs/decisions/0004-event-sourced-session-log.md` (model change,
migration policy, no-redo, warning-over-auto-adjust decision).

## 4. UI design (`apps/client`)

### 4.1 Context (`session-context.tsx`)

Add to `SessionContextValue`:

```ts
readonly editRound: (command: SessionEditCommand) => SessionEditResult;   // commits + persists on success
readonly previewEdit: (command: SessionEditCommand) => SessionEditResult; // pure, no persist
```

`declarePlayerRiichi(playerIndex)` keeps its signature and supplies
`createRoundCommandMetadata()` internally. `commit()` is unchanged; a rejected edit does
not call `commit`.

### 4.2 Session screen

- **Entry point:** each history row gains an "Edit" `ActionButton` (variant `paper`,
  ≥48px target) with an accessible name including the round identity, e.g. "Edit East 2,
  Aki won by ron". Rendered only when the round id is in `editableRoundIds(state)`; for a
  `restored-baseline` legacy session, the panel shows a muted one-liner: "Rounds recorded
  before this update can't be edited."
- **Edit surface:** an inline expanding editor under the row (matches the existing inline
  `confirmEnd` pattern; no modal dependency):
  - *Draw rounds:* tenpai chips (same checkbox chips as the live draw panel) + riichi
    chips for that hand + "Delete this round".
  - *Win rounds, phase 4a:* winner and discarder reassignment (chips), riichi chips, and
    "Delete this round". Payment amounts display read-only.
  - *Win rounds, phase 4b:* "Re-score this hand" pushes the manual calculator with
    `?editRound=<id>`; the calculator seeds honba/sticks/riichi from
    `tableBeforeRound(...)` and, on save, calls `editRound({ kind: "replace-round", ... })`
    instead of `recordWin`.
- **Confirmation (mandatory, score-changing):** on "Apply", run `previewEdit` and render
  the `EditReview` in a confirm panel styled like the existing end-table confirm: per-player
  final-score changes as signed text (never color alone), the list of later rounds whose
  wind/hand/honba shifted, and any `stale-honba-payment` / `stale-dealer-payment` warnings
  phrased as actions ("South 1's payment was entered with 1 honba; it now replays at 0
  honba — re-score that round if the bonus should change"). Buttons: "Apply correction"
  (vermilion) / "Keep as recorded" (paper). After applying: focus returns to the history
  panel, an `accessibilityLiveRegion="polite"` message announces "Round corrected. Scores
  updated. Undo is available.", and the existing "Undo last change" button reverts it.
- **Rejections:** typed errors render inline next to the editor (e.g. riichi-underfunded:
  "This change would leave Chi with under 1,000 points at their later riichi in South 2.
  Remove that riichi declaration first or adjust the correction.").

## 5. Test plan (highest value first)

Domain (`session-core`, Vitest, TDD):

1. **Replay equivalence (the keystone):** for representative and generated sequences of
   `declareRiichi`/`applyWin`/`applyDraw`, the incrementally-built `state.table`
   deep-equals `replaySessionEvents(state.base, state.events)` — including `history`
   byte-for-byte. All existing tests in `session.test.ts` continue to pass unmodified
   except the two `declareRiichi` call-shape updates.
2. **Riichi-timing preservation:** declare (P2) → draw (sticks carry) → declare (P3) →
   P1 wins: pool payout 2000. Then (a) edit the draw's tenpai set — both riichi deductions
   and payout unchanged; (b) delete the draw round — its segment riichi is removed and the
   later winner's pool correctly recomputes to 1000. This test fails on any design that
   loses riichi interleaving.
3. **Edit-then-recompute:** replace a mid-session winner → downstream
   `dealerIndex`/`handNumber`/`roundWind`/`honba` and final scores equal a from-scratch
   replay of the corrected sequence; delete a dealer-repeat win → honba chain and
   `changedRounds` diff correct.
4. **Warnings:** an edit that changes a later win's honba emits `stale-honba-payment` for
   exactly that round; a dealer-flip on a later tsumo emits `stale-dealer-payment`.
5. **Typed rejections leave state untouched:** `round-not-found`, `invalid-revision`
   (ron/self-discarder, tsumo+discarder), `riichi-underfunded` (edit drains a later
   declarer below 1,000), `round-not-editable` on a restored-baseline session.
6. **Undo:** append→edit→undo restores the exact pre-edit `SessionState` (`toEqual`);
   undo of appends unchanged; empty-stack no-op.

Migration (`apps/client`, extend `stored-session.test.ts`):

7. **Round-trip with riichi:** a *frozen v1 JSON fixture* (built once from the old
   reducers, including riichi declarations, a carried stick draw, and an undo) parses to
   v2; replay equals the fixture's `table`; then an edit on the migrated session produces
   correct scores — proving riichi events were reconstructed at the right positions, not
   just that scores match.
8. **Fallback:** a v1 payload with a truncated/inconsistent `undoStack` loads as
   `restored-baseline` with scores and history identical and editing disabled; the existing
   `rulesProfileId` migration tests keep passing through the new path; v2 payloads
   round-trip save→load.

UI (Jest Expo) and E2E:

9. Component: edit button accessible name; preview panel shows signed score changes and
   warnings; "Keep as recorded" leaves history/scores unchanged; "Apply correction" updates
   history and announces via live region; legacy session hides edit affordances with
   explanation.
10. One E2E journey: record two rounds with a riichi, edit the first round's tenpai set,
    verify corrected scores and that undo reverts.

## 6. Risks and explicit decisions

| Risk / decision | Resolution |
|---|---|
| Honba bonus baked into stored payments | Replay verbatim + `stale-honba-payment` warning; never auto-adjust (user may have overridden honba). Phase 5 may store `basePoints` on new `WinEvent`s additively. |
| Dealer/non-dealer tsumo split baked into payments | `stale-dealer-payment` warning; re-score via calculator edit mode. |
| Migration fidelity | Snapshot-diff reconstruction is *verified* by replay-equality; unverifiable traces degrade to a lossless read-only baseline. v1 key preserved until first successful v2 save. |
| Later riichi becoming unaffordable after an edit | Typed rejection, actionable message; never a throw, never partial application. |
| `declareRiichi` signature change | Single call site + two tests; keeps domain clock-free. |
| Persisted undo growth (O(n²) event copies) | Cap persisted undo depth at 50; in-memory unchanged. |
| Redo | Out of scope; representation supports adding it later. ADR notes both. |
| Replay cost | O(events) pure arithmetic on undo/edit only; appends stay incremental. |

## 7. Phased delivery

Each phase is independently shippable and gated by `npm run check`; Phases 1–2 change no
user-visible behavior.

1. **Phase 1 — event core (no behavior change):** types, table-level appliers extracted
   from reducers, `replaySessionEvents`, `SessionState` reshape, reducers append events,
   `RiichiCommand` signature change, replay-equivalence + riichi-timing tests.
2. **Phase 2 — persistence:** `StoredSessionV2`, `reconstructSessionFromSnapshots`, adapter
   key handling, migration tests, undo-depth cap, ADR 0004.
3. **Phase 3 — edit domain:** `editSessionRound`/`previewSessionEdit`, `EditReview`,
   warnings, `editableRoundIds`, `tableBeforeRound`, rejection tests. Export from `index.ts`.
4. **Phase 4a — UI:** context methods, history edit affordance, draw/riichi inline editor,
   delete, confirmation preview, accessibility, component tests, E2E journey.
5. **Phase 4b — win re-scoring:** manual calculator `editRound` mode seeded from
   `tableBeforeRound`.
6. **Phase 5 (optional) — honba-aware payments:** store `basePoints` on new win events;
   replay recomputes honba bonus; warnings become auto-fix offers.

### Critical files for implementation

- `packages/session-core/src/domain/session.ts`
- `packages/session-core/src/application/session.ts`
- `apps/client/src/infrastructure/stored-session.ts`
- `apps/client/src/state/session-context.tsx`
- `apps/client/src/screens/session-screen.tsx`
