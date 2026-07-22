# ADR 0002: Platform-specific local session storage

- Status: accepted
- Date: 2026-07-23

## Context

Table sessions must survive reloads and native app restarts without requiring an account or backend. The session domain cannot depend on persistence, and pulling Expo SQLite's WASM implementation into the browser increased coupling and failed static export when its generated artifact was unavailable.

## Decision

Persist one versioned, serialized `SessionState` document behind a small client adapter contract:

- Web uses browser `localStorage`.
- iOS and Android use Expo SQLite's key-value storage adapter.
- The shared reader parses JSON as `unknown` and validates its outer structure before exposing domain state.
- The React session provider owns hydration and reports recoverable read/write failures in user language.

`session-core` remains pure. IDs and timestamps are supplied by client commands, and every state transition can be tested without a database or clock.

## Consequences

The browser does not download or initialize a SQLite/WASM runtime for a single small document. Native receives durable SQLite-backed storage without a backend. Storage is intentionally device-local; cross-device synchronization, schema migrations beyond version replacement, and large history archives require a future decision.
