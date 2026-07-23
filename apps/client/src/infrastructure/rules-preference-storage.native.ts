import type { ScoringRulesProfileId } from "@richii/rules";
import Storage from "expo-sqlite/kv-store";

import { parseRulesPreference } from "../features/rules/rules-preference";

const storageKey = "richii.rules-profile.v1";

export async function loadRulesPreference(): Promise<ScoringRulesProfileId> {
  return parseRulesPreference(await Storage.getItem(storageKey));
}

export async function saveRulesPreference(profileId: ScoringRulesProfileId): Promise<void> {
  await Storage.setItem(storageKey, profileId);
}
