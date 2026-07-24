import { createSession } from "@riichimi/session-core";

import { loadRulesPreference, saveRulesPreference } from "./rules-preference-storage";
import { loadScoreHistory } from "./score-history-storage";
import { loadStoredSession, saveStoredSession } from "./session-storage";
import { serializeStoredSession } from "./stored-session";

// A minimal localStorage so the web adapters can be exercised directly.
function useFakeStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      removeItem: (key: string) => store.delete(key),
      setItem: (key: string, value: string) => store.set(key, value),
    },
  });
  return store;
}

// Built through the real serializer so the fixture cannot drift from the format
// the app actually writes.
const storedSession = serializeStoredSession(
  createSession({
    id: "table-1",
    playerNames: ["Aki", "Bo", "Cy", "Di"],
    rulesProfileId: "wrc-2025",
    startedAt: "2026-07-01T00:00:00.000Z",
  }),
);

// The project was renamed from "richii" to "riichimi". Anything a player had
// already saved must survive that, or the rename quietly destroys their data.
describe("reading data saved before the project rename", () => {
  it("still finds a score folio stored under the old key", async () => {
    useFakeStorage({
      "richii.score-history.v1": JSON.stringify({ entries: [], version: 1 }),
    });

    expect(await loadScoreHistory()).not.toBeNull();
  });

  it("still applies a rules profile chosen under the old key", async () => {
    useFakeStorage({ "richii.rules-profile.v1": "wrc-2025-red-five-table" });

    expect(await loadRulesPreference()).toBe("wrc-2025-red-five-table");
  });

  it("still resumes a table saved under the old key", async () => {
    useFakeStorage({ "richii.session.v2": storedSession });

    expect(await loadStoredSession()).not.toBeNull();
  });

  it("prefers current data over a stale pre-rename copy", async () => {
    useFakeStorage({
      "richii.rules-profile.v1": "wrc-2025-red-five-table",
      "riichimi.rules-profile.v1": "wrc-2025",
    });

    expect(await loadRulesPreference()).toBe("wrc-2025");
  });

  it("writes under the current key and retires the pre-rename copy", async () => {
    const store = useFakeStorage({ "richii.session.v2": storedSession });
    const restored = await loadStoredSession();
    if (restored === null) {
      throw new Error("Expected the pre-rename table to load.");
    }

    await saveStoredSession(restored);
    await saveRulesPreference("wrc-2025");

    expect(store.get("riichimi.session.v2")).toBeDefined();
    expect(store.has("richii.session.v2")).toBe(false);
    expect(store.get("riichimi.rules-profile.v1")).toBe("wrc-2025");
  });
});
