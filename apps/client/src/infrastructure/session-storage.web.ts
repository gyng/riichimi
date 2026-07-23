import type { SessionState } from "@richii/session-core";

import { parseStoredSession, serializeStoredSession } from "./stored-session";

const storageKeyV2 = "richii.session.v2";
const storageKeyV1 = "richii.session.v1";

export async function loadStoredSession(): Promise<SessionState | null> {
  const stored = globalThis.localStorage;
  const v2 = stored?.getItem(storageKeyV2) ?? null;
  if (v2 !== null) {
    return parseStoredSession(v2);
  }
  const v1 = stored?.getItem(storageKeyV1) ?? null;
  return v1 === null ? null : parseStoredSession(v1);
}

export async function saveStoredSession(state: SessionState | null): Promise<void> {
  const stored = globalThis.localStorage;
  if (stored === undefined) {
    return;
  }
  if (state === null) {
    stored.removeItem(storageKeyV2);
    stored.removeItem(storageKeyV1);
    return;
  }
  stored.setItem(storageKeyV2, serializeStoredSession(state));
  // Only retire the legacy key once a v2 write has succeeded, so a migration
  // defect can never destroy the original data before it is safely re-stored.
  stored.removeItem(storageKeyV1);
}
