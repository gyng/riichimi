import { scoringRulesProfile, scoringRulesProfiles } from "@riichimi/rules";
import { SegmentedControl } from "@riichimi/ui";

import { useRules } from "../../state/rules-context";

import type { ScoringRules } from "@riichimi/score-core";

import { HouseRulesEditor } from "./house-rules-editor";
import { houseRulesProfileId, houseScoringRules } from "./house-rules";
import { parseRulesPreference } from "./rules-preference";
import { useLocale } from "../../state/locale-context";
import styles from "./rules-profile-control.module.css";

const options = [
  ...scoringRulesProfiles.map((profile) => ({ label: profile.label, value: profile.id })),
  { label: "House rules", value: houseRulesProfileId },
];

/**
 * Describe a profile from its actual options rather than prose, so the summary
 * cannot drift from what the scorer does.
 */
function describeProfile(profile: ScoringRules, t: (source: string) => string): string {
  return [
    profile.redFives ? t("red fives") : t("no red fives"),
    profile.allowOpenTanyao ? t("open tanyao") : t("closed tanyao only"),
    profile.kiriageMangan ? t("round-up mangan") : t("no round-up mangan"),
    profile.countedLimit === "yonbaiman" ? t("kazoe yakuman") : t("counted hands cap at sanbaiman"),
    profile.uraDora ? t("ura-dora") : t("no ura-dora"),
    profile.yakumanStacking === "single" ? t("yakuman never combine") : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

export function RulesProfileControl({
  lockedProfileId,
}: {
  readonly lockedProfileId?: string | undefined;
}) {
  const { t } = useLocale();
  const rules = useRules();
  const activeId = lockedProfileId ?? rules.activeRules.id;
  const isHouse = activeId === houseRulesProfileId;
  const selected = isHouse ? houseScoringRules(rules.houseRules) : scoringRulesProfile(activeId);
  const locked = lockedProfileId !== undefined;

  return (
    <div className={styles["card"]}>
      <div className={styles["copy"]}>
        <p className={styles["kicker"]}>
          {locked ? t("SCORING RULES · PINNED TO TABLE") : t("SCORING RULES · SAVED LOCALLY")}
        </p>
        <h2 className={styles["title"]}>{selected.label}</h2>
        <p className={styles["note"]}>
          {locked ? t("Pinned at East 1.") : describeProfile(selected, t)}
        </p>
      </div>
      {locked ? null : (
        <div className={styles["control"]}>
          <SegmentedControl
            accessibilityLabel="Scoring rules profile"
            onChange={(value) => {
              rules.selectProfile(parseRulesPreference(value));
            }}
            options={options}
            value={selected.id}
          />
        </div>
      )}
      {isHouse ? (
        <div className={styles["editor"]}>
          <HouseRulesEditor locked={locked} />
        </div>
      ) : null}
      {rules.storageError === null ? null : (
        <p aria-live="polite" className={styles["error"]}>
          {rules.storageError}
        </p>
      )}
    </div>
  );
}
