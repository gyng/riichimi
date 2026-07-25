import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * jsdom implements no media queries at all. Answering "no" to every one is the
 * honest default for a test browser: motion is not reduced and no display
 * preference is set, so components take their ordinary path.
 */
class StubMediaQueryList extends EventTarget {
  readonly matches = false;
  readonly onchange = null;

  constructor(readonly media: string) {
    super();
  }

  addListener(): void {}

  removeListener(): void {}
}

if (window.matchMedia === undefined) {
  window.matchMedia = (query: string) => new StubMediaQueryList(query);
}

// Screens mount into a shared jsdom document, so anything left behind would be
// found by the next test's queries.
afterEach(() => {
  cleanup();
});
