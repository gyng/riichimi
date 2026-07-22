# ADR 0003: WebMCP as progressive enhancement

- Status: accepted
- Date: 2026-07-23

## Context

Richii should require minimal manual work for both people and user-directed agents. The browser can expose task-level operations, but an agent interface must not bypass the same validation, visibility, privacy, or recovery guarantees as the human interface. WebMCP is still an emerging browser capability and cannot be a runtime prerequisite.

## Decision

Use the proposed `document.modelContext` WebMCP API through the official `webmcp-types` package:

- Register app-wide navigation, score-history inspection, and table tools at the client composition root.
- Register manual-calculator tools only while that screen is mounted.
- Declare strict JSON input schemas and independently narrow every value at execution boundaries.
- Annotate read-only tools and make mutations immediately visible in the app.
- Route table changes through the existing session context so persistence, invariants, history, and undo remain authoritative.
- Allow a displayed, successfully calculated hand to be posted into its active table through the same visible and undoable action as the button.
- Expose no destructive table-clear, camera-permission, upload, or hidden inference tool.
- Treat missing support or rejected registration as a no-op; every task remains available through visible controls.

Tool wrappers stay registered across ordinary React renders and dispatch to the latest state closure. An `AbortSignal` unregisters them when their owning component unmounts.

## Consequences

Supporting browsers and agents can discover semantically meaningful actions without scraping coordinates or recreating scoring policy. Humans retain control because routes and mutations are visible and undoable. The app gains a small experimental browser boundary that needs dogfood coverage as the proposal evolves; native clients and browsers without WebMCP continue unchanged.

References: [WebMCP proposal and specification](https://github.com/webmachinelearning/webmcp), [WebMCP type definitions](https://www.npmjs.com/package/webmcp-types).
