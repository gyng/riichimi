import { isScoringRulesProfileId, wrc2025Rules } from "@riichimi/rules";
import type { ScoringRulesProfileId } from "@riichimi/rules";

import { houseRulesProfileId } from "./house-rules";

export type RulesPreference = ScoringRulesProfileId | typeof houseRulesProfileId;

export function parseRulesPreference(value: string | null): RulesPreference {
  if (value === houseRulesProfileId) {
    return houseRulesProfileId;
  }
  return value !== null && isScoringRulesProfileId(value) ? value : wrc2025Rules.id;
}
