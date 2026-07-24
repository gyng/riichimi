import { parseRulesPreference } from "../features/rules/rules-preference";
import type { RulesPreference } from "../features/rules/rules-preference";

const storageKey = "riichimi.rules-profile.v1";
// A profile chosen before the project rename still applies.
const renamedStorageKey = "richii.rules-profile.v1";

export async function loadRulesPreference(): Promise<RulesPreference> {
  const stored = globalThis.localStorage;
  return parseRulesPreference(
    stored?.getItem(storageKey) ?? stored?.getItem(renamedStorageKey) ?? null,
  );
}

export async function saveRulesPreference(profileId: RulesPreference): Promise<void> {
  globalThis.localStorage?.setItem(storageKey, profileId);
}
