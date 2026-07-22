import type { SessionState } from "@richii/session-core";
import Storage from "expo-sqlite/kv-store";

import { parseStoredSession } from "./stored-session";

const storageKey = "richii.session.v1";

export async function loadStoredSession(): Promise<SessionState | null> {
  const value = await Storage.getItem(storageKey);
  return value === null ? null : parseStoredSession(value);
}

export async function saveStoredSession(state: SessionState | null): Promise<void> {
  if (state === null) {
    await Storage.removeItem(storageKey);
    return;
  }
  await Storage.setItem(storageKey, JSON.stringify(state));
}
