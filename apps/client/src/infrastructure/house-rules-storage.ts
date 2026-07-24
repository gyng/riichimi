import { parseHouseRules, serializeHouseRules } from "../features/rules/house-rules";
import type { HouseRules } from "../features/rules/house-rules";

const storageKey = "riichimi.house-rules.v1";

export async function loadHouseRules(): Promise<HouseRules> {
  return parseHouseRules(globalThis.localStorage?.getItem(storageKey) ?? null);
}

export async function saveHouseRules(rules: HouseRules): Promise<void> {
  globalThis.localStorage?.setItem(storageKey, serializeHouseRules(rules));
}
