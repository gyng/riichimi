import type { SessionState } from "@richii/session-core";

import { parseStoredSession } from "./stored-session";

const storageKey = "richii.session.v1";

export async function loadStoredSession(): Promise<SessionState | null> {
  const value = globalThis.localStorage?.getItem(storageKey) ?? null;
  return value === null ? null : parseStoredSession(value);
}

export async function saveStoredSession(state: SessionState | null): Promise<void> {
  if (state === null) {
    globalThis.localStorage?.removeItem(storageKey);
    return;
  }
  globalThis.localStorage?.setItem(storageKey, JSON.stringify(state));
}
