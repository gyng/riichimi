import type { ScoringRulesProfileId } from "@richii/rules";

import { parseRulesPreference } from "../features/rules/rules-preference";

const storageKey = "richii.rules-profile.v1";

export async function loadRulesPreference(): Promise<ScoringRulesProfileId> {
  return parseRulesPreference(globalThis.localStorage?.getItem(storageKey) ?? null);
}

export async function saveRulesPreference(profileId: ScoringRulesProfileId): Promise<void> {
  globalThis.localStorage?.setItem(storageKey, profileId);
}
