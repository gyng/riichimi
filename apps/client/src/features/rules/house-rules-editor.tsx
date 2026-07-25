import { Checkbox, SegmentedControl, classNames } from "@riichimi/ui";

import { useRules } from "../../state/rules-context";
import type { HouseRules } from "./house-rules";
import { useLocale } from "../../state/locale-context";
import { useId } from "react";

import styles from "./house-rules-editor.module.css";

type Translate = (source: string) => string;

const limitOptionsFor = (t: Translate) =>
  [
    { label: t("Kazoe yakuman"), value: "yonbaiman" },
    { label: t("Cap at sanbaiman"), value: "sanbaiman" },
  ] as const;

const windFuOptions = [
  { label: "2 fu", value: "2" },
  { label: "4 fu", value: "4" },
] as const;

const stackingOptionsFor = (t: Translate) =>
  [
    { label: t("Add up"), value: "additive" },
    { label: t("Never combine"), value: "single" },
  ] as const;

const togglesFor = (t: Translate) =>
  [
    { key: "redFives", label: t("Red fives count as dora") },
    { key: "allowOpenTanyao", label: t("Open tanyao (kuitan)") },
    { key: "kiriageMangan", label: t("Round-up mangan") },
    { key: "uraDora", label: t("Ura-dora") },
    { key: "doubleYakuman", label: t("Single-yaku double yakuman") },
  ] as const satisfies readonly { key: keyof HouseRules; label: string }[];

/**
 * Lets a table state its own rules. Editing is blocked while a table is pinned
 * to this profile: a running table's scoring must not change under it.
 */
export function HouseRulesEditor({ locked }: { readonly locked: boolean }) {
  const { t } = useLocale();
  const limitOptions = limitOptionsFor(t);
  const stackingOptions = stackingOptionsFor(t);
  const toggles = togglesFor(t);
  const rules = useRules();
  const house = rules.houseRules;
  // One id per visible field label, so each control can point at the words
  // already on screen instead of repeating them.
  const group = useId();
  const labelIds = {
    countedLimit: `${group}-countedLimit`,
    yakumanStacking: `${group}-yakumanStacking`,
    windFu: `${group}-windFu`,
  };

  function update(patch: Partial<HouseRules>) {
    rules.saveHouseRules({ ...house, ...patch });
  }

  return (
    <div className={styles["card"]}>
      <p className={styles["kicker"]}>HOUSE RULES · THIS DEVICE</p>
      <h3 className={styles["title"]}>{t("Rules your table plays by")}</h3>
      <p className={styles["note"]}>
        {locked
          ? t("In use by a table. End it to edit.")
          : t("Local profile. Everything else follows WRC 2025.")}
      </p>

      <p className={styles["fieldLabel"]}>{t("NAME")}</p>
      <input
        aria-label={t("House rules name")}
        className={classNames(styles["input"], locked && styles["locked"])}
        onChange={(event) => update({ label: event.target.value })}
        placeholder="House rules"
        readOnly={locked}
        value={house.label}
      />

      {toggles.map((toggle) => (
        <Checkbox
          checked={house[toggle.key]}
          disabled={locked}
          key={toggle.key}
          label={toggle.label}
          onChange={(checked) => update({ [toggle.key]: checked })}
        />
      ))}

      <p id={labelIds.countedLimit} className={styles["fieldLabel"]}>
        {t("13+ HAN WITHOUT A YAKUMAN")}
      </p>
      <SegmentedControl
        labelledBy={labelIds.countedLimit}
        onChange={(countedLimit) => {
          if (!locked) {
            update({ countedLimit });
          }
        }}
        options={limitOptions}
        value={house.countedLimit}
      />

      <p id={labelIds.yakumanStacking} className={styles["fieldLabel"]}>
        {t("COMBINED YAKUMAN")}
      </p>
      <SegmentedControl
        labelledBy={labelIds.yakumanStacking}
        onChange={(yakumanStacking) => {
          if (!locked) {
            update({ yakumanStacking });
          }
        }}
        options={stackingOptions}
        value={house.yakumanStacking}
      />

      <p id={labelIds.windFu} className={styles["fieldLabel"]}>
        {t("PAIR THAT IS BOTH WINDS")}
      </p>
      <SegmentedControl
        labelledBy={labelIds.windFu}
        onChange={(value) => {
          if (!locked) {
            update({ doubleWindPairFu: value === "4" ? 4 : 2 });
          }
        }}
        options={windFuOptions}
        value={house.doubleWindPairFu === 4 ? "4" : "2"}
      />
    </div>
  );
}
