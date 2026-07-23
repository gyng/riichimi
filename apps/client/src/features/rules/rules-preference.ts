import { isScoringRulesProfileId, wrc2025Rules } from "@richii/rules";
import type { ScoringRulesProfileId } from "@richii/rules";

export function parseRulesPreference(value: string | null): ScoringRulesProfileId {
  return value !== null && isScoringRulesProfileId(value) ? value : wrc2025Rules.id;
}
