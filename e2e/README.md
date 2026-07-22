# End-to-end tests

Playwright protects the browser journeys where wiring matters more than combinatorial rule coverage:

- the responsive landing page;
- WebMCP discovery and tool execution;
- manual example loading and scoring; and
- starting, changing, and undoing a local table session.

Domain examples remain in the fast Vitest suite. Run `npm run build:web && npm run test:e2e` after changing routing, persistence, or browser tooling.

`npm run serve:web` serves the export with clean-route resolution (`/history` → `history.html`), matching the routing behavior required from production static hosting and making direct links and reloads testable. `npm run test:e2e` owns that server lifecycle and waits for its explicit readiness signal before starting Playwright.
