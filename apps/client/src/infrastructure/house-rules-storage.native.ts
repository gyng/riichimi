import Storage from "expo-sqlite/kv-store";

import { parseHouseRules, serializeHouseRules } from "../features/rules/house-rules";
import type { HouseRules } from "../features/rules/house-rules";

const storageKey = "riichimi.house-rules.v1";

export async function loadHouseRules(): Promise<HouseRules> {
  return parseHouseRules(await Storage.getItem(storageKey));
}

export async function saveHouseRules(rules: HouseRules): Promise<void> {
  await Storage.setItem(storageKey, serializeHouseRules(rules));
}
