import type { SessionState } from "@riichimi/session-core";

import { parseStoredSession, serializeStoredSession } from "./stored-session";

const storageKeyV2 = "riichimi.session.v2";
const storageKeyV1 = "riichimi.session.v1";
// Tables saved before the project was renamed from "richii". They are read in
// the same newest-first order so an in-progress table survives the rename.
const renamedKeyV2 = "richii.session.v2";
const renamedKeyV1 = "richii.session.v1";

export async function loadStoredSession(): Promise<SessionState | null> {
  const stored = globalThis.localStorage;
  const value =
    stored?.getItem(storageKeyV2) ??
    stored?.getItem(renamedKeyV2) ??
    stored?.getItem(storageKeyV1) ??
    stored?.getItem(renamedKeyV1) ??
    null;
  return value === null ? null : parseStoredSession(value);
}

export async function saveStoredSession(state: SessionState | null): Promise<void> {
  const stored = globalThis.localStorage;
  if (stored === undefined) {
    return;
  }
  if (state === null) {
    for (const key of [storageKeyV2, storageKeyV1, renamedKeyV2, renamedKeyV1]) {
      stored.removeItem(key);
    }
    return;
  }
  stored.setItem(storageKeyV2, serializeStoredSession(state));
  // Only retire the superseded keys once a v2 write has succeeded, so a
  // migration defect can never destroy the original data before it is re-stored.
  stored.removeItem(storageKeyV1);
  stored.removeItem(renamedKeyV2);
  stored.removeItem(renamedKeyV1);
}
