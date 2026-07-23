import type { SessionState } from "@riichimi/session-core";
import Storage from "expo-sqlite/kv-store";

import { parseStoredSession, serializeStoredSession } from "./stored-session";

const storageKeyV2 = "riichimi.session.v2";
const storageKeyV1 = "riichimi.session.v1";
// See the web adapter: tables saved before the project rename stay readable.
const renamedKeyV2 = "richii.session.v2";
const renamedKeyV1 = "richii.session.v1";

export async function loadStoredSession(): Promise<SessionState | null> {
  for (const key of [storageKeyV2, renamedKeyV2, storageKeyV1, renamedKeyV1]) {
    const value = await Storage.getItem(key);
    if (value !== null) {
      return parseStoredSession(value);
    }
  }
  return null;
}

export async function saveStoredSession(state: SessionState | null): Promise<void> {
  if (state === null) {
    for (const key of [storageKeyV2, storageKeyV1, renamedKeyV2, renamedKeyV1]) {
      await Storage.removeItem(key);
    }
    return;
  }
  await Storage.setItem(storageKeyV2, serializeStoredSession(state));
  // Only retire the superseded keys once a v2 write has succeeded, so a
  // migration defect can never destroy the original data before it is re-stored.
  for (const key of [storageKeyV1, renamedKeyV2, renamedKeyV1]) {
    await Storage.removeItem(key);
  }
}
