import type { ScoreHandResult } from "@riichimi/score-core";
import { classNames } from "@riichimi/ui";

import { AnnounceBesideScore } from "../announcer/announce-beside-score";
import { useLocale } from "../../state/locale-context";
import styles from "./score-result-panel.module.css";

export interface ScoreResultPanelProps {
  /** Speaks the score on screen. Absent where announcing makes no sense. */
  readonly onSayAgain?: (() => void) | undefined;
  readonly result: ScoreHandResult;
}

function points(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function ScoreResultPanel({ onSayAgain, result }: ScoreResultPanelProps) {
  const { t } = useLocale();
  if (result.kind === "invalid") {
    return (
      <section aria-live="polite" className={classNames(styles["panel"], styles["error"])}>
        <h2 className={styles["errorTitle"]}>{t("Check the hand")}</h2>
        {result.issues.map((issue) => (
          <p className={styles["errorItem"]} key={`${issue.code}-${issue.message}`}>
            • {issue.message}
          </p>
        ))}
      </section>
    );
  }

  if (result.kind === "not-winning" || result.kind === "no-yaku") {
    return (
      <section aria-live="polite" className={classNames(styles["panel"], styles["error"])}>
        <h2 className={styles["errorTitle"]}>
          {result.kind === "not-winning" ? t("Not a complete hand") : t("A yaku is still needed")}
        </h2>
        <p className={styles["errorItem"]}>{result.message}</p>
      </section>
    );
  }

  const title =
    result.limit === null
      ? `${result.han ?? 0} ${t("han")} · ${result.fu?.rounded ?? 0} ${t("fu")}`
      : result.limit.toUpperCase();
  const payment =
    result.payments.kind === "ron"
      ? `${points(result.payments.fromDiscarder)} ${t("from discarder")}`
      : result.payments.fromDealer === null
        ? `${points(result.payments.fromEachNonDealer)} ${t("all")}`
        : `${points(result.payments.fromDealer)} / ${points(result.payments.fromEachNonDealer)}`;

  return (
    <section aria-live="polite" className={classNames(styles["panel"], styles["success"])}>
      <p className={styles["kicker"]}>{t("MAXIMUM-VALUE INTERPRETATION")}</p>
      <h2 className={styles["score"]}>{title}</h2>
      <p className={styles["payment"]}>{payment}</p>
      <p className={styles["total"]}>
        {t("Winner receives")} {points(result.totalGain)} {t("points total")}
      </p>
      {onSayAgain === undefined ? null : <AnnounceBesideScore onSayAgain={onSayAgain} />}

      <div className={styles["divider"]} />

      <p className={styles["sectionTitle"]}>
        {result.yakuman.length > 0 ? t("Yakuman") : t("Yaku")}
      </p>
      {/* Cheapest first, the same order the announcement reads them in. The two
          surfaces used to disagree: the voice built towards the big yaku while
          the panel listed them in the order the detector happened to find
          them. */}
      {(result.yakuman.length > 0
        ? result.yakuman
        : result.yaku.toSorted((left, right) => left.han - right.han)
      ).map((item) => (
        <div className={styles["lineItem"]} key={item.id}>
          <div className={styles["lineCopy"]}>
            <p className={styles["japanese"]}>{item.japanese}</p>
            <p className={styles["reading"]}>{item.romanized}</p>
            <p className={styles["english"]}>{item.name}</p>
          </div>
          <p className={styles["value"]}>
            {"han" in item ? `${item.han} ${t("han")}` : `${item.value}×`}
          </p>
        </div>
      ))}

      {result.dora.total > 0 ? (
        <div className={styles["lineItem"]}>
          <div className={styles["lineCopy"]}>
            <p className={styles["lineTitle"]}>{t("Dora")}</p>
            <p className={styles["lineNote"]}>
              {t("Visible")} {result.dora.dora} · {t("Ura")} {result.dora.uraDora} · {t("Red")}{" "}
              {result.dora.redDora}
            </p>
          </div>
          <p className={styles["value"]}>
            {result.dora.total} {t("han")}
          </p>
        </div>
      ) : null}

      {result.fu !== null ? (
        <>
          <div className={styles["divider"]} />
          <p className={styles["sectionTitle"]}>{t("Fu audit")}</p>
          {result.fu.items.map((item, index) => (
            <div className={styles["fuRow"]} key={`${item.reason}-${index}`}>
              <p className={styles["lineNote"]}>{item.reason}</p>
              <p className={styles["fuValue"]}>+{item.fu}</p>
            </div>
          ))}
          <p className={styles["rounding"]}>
            {result.fu.unrounded} {t("fu")} → {result.fu.rounded} {t("fu")}
          </p>
        </>
      ) : null}

      {result.riichiBonus > 0 ? (
        <p className={styles["bonus"]}>
          {t("Includes")} {points(result.riichiBonus)} {t("points in riichi deposits.")}
        </p>
      ) : null}
    </section>
  );
}
