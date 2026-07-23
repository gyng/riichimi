import { isScoringRulesProfileId, tenhouRules } from "@riichimi/rules";
import type { ScoringRulesProfileId } from "@riichimi/rules";

import { houseRulesProfileId } from "./house-rules";

export type RulesPreference = ScoringRulesProfileId | typeof houseRulesProfileId;

export function parseRulesPreference(value: string | null): RulesPreference {
  if (value === houseRulesProfileId) {
    return houseRulesProfileId;
  }
  // Tenhou is the default a new device starts on; a stored choice always wins.
  return value !== null && isScoringRulesProfileId(value) ? value : tenhouRules.id;
}
