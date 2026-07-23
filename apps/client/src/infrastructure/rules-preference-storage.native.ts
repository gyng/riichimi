import type { ScoringRulesProfileId } from "@riichimi/rules";
import Storage from "expo-sqlite/kv-store";

import { parseRulesPreference } from "../features/rules/rules-preference";

const storageKey = "riichimi.rules-profile.v1";
// A profile chosen before the project rename still applies.
const renamedStorageKey = "richii.rules-profile.v1";

export async function loadRulesPreference(): Promise<ScoringRulesProfileId> {
  const stored = (await Storage.getItem(storageKey)) ?? (await Storage.getItem(renamedStorageKey));
  return parseRulesPreference(stored);
}

export async function saveRulesPreference(profileId: ScoringRulesProfileId): Promise<void> {
  await Storage.setItem(storageKey, profileId);
}
