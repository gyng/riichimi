import type { SessionState } from "@richii/session-core";
import Storage from "expo-sqlite/kv-store";

import { parseStoredSession, serializeStoredSession } from "./stored-session";

const storageKeyV2 = "richii.session.v2";
const storageKeyV1 = "richii.session.v1";

export async function loadStoredSession(): Promise<SessionState | null> {
  const v2 = await Storage.getItem(storageKeyV2);
  if (v2 !== null) {
    return parseStoredSession(v2);
  }
  const v1 = await Storage.getItem(storageKeyV1);
  return v1 === null ? null : parseStoredSession(v1);
}

export async function saveStoredSession(state: SessionState | null): Promise<void> {
  if (state === null) {
    await Storage.removeItem(storageKeyV2);
    await Storage.removeItem(storageKeyV1);
    return;
  }
  await Storage.setItem(storageKeyV2, serializeStoredSession(state));
  // Only retire the legacy key once a v2 write has succeeded, so a migration
  // defect can never destroy the original data before it is safely re-stored.
  await Storage.removeItem(storageKeyV1);
}
