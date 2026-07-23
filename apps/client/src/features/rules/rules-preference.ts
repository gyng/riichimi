import { isScoringRulesProfileId, wrc2025Rules } from "@riichimi/rules";
import type { ScoringRulesProfileId } from "@riichimi/rules";

export function parseRulesPreference(value: string | null): ScoringRulesProfileId {
  return value !== null && isScoringRulesProfileId(value) ? value : wrc2025Rules.id;
}
