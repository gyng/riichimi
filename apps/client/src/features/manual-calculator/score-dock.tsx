import { ActionButton, classNames } from "@riichimi/ui";
import type { ScoreHandResult } from "@riichimi/score-core";

import { useLocale } from "../../state/locale-context";
import { scoreHeadline, scoreProblem } from "./score-headline";
import styles from "./score-dock.module.css";

export interface ScoreDockProps {
  readonly onCalculate: () => void;
  readonly onShowAudit: () => void;
  readonly result: ScoreHandResult | null;
}

/**
 * The calculator's action and its answer, in one place at the bottom of the
 * screen.
 *
 * The hand, the picker, and the context are about two and a half screens on a
 * phone, so a score rendered after them arrives below the fold — the one number
 * the screen exists to produce, off screen at the moment it is produced.
 * Scrolling to it fixes that once and breaks again as soon as a player scrolls
 * back up to change a tile.
 *
 * Docking it fixes it for good, and costs no new state: every input already
 * clears the result, so this shows `Calculate` exactly when there is something
 * to calculate and the score exactly when there is one. The panel above keeps
 * the reasoning — yaku, fu, payments — and `See the audit` goes to it.
 */
export function ScoreDock({ onCalculate, onShowAudit, result }: ScoreDockProps) {
  const { t } = useLocale();

  if (result === null) {
    return (
      <div className={styles["dock"]}>
        <ActionButton label={t("Calculate")} onPress={onCalculate} variant="vermilion" />
      </div>
    );
  }

  const headline = scoreHeadline(result, t);
  const problem = scoreProblem(result, t);

  // Deliberately not a live region: the audit panel already announces the
  // score, and two would read it twice.
  return (
    <div
      className={classNames(
        styles["dock"],
        headline === null ? styles["problem"] : styles["scored"],
      )}
    >
      <div className={styles["reading"]}>
        <p className={styles["title"]}>{headline?.title ?? problem}</p>
        {headline === null ? null : <p className={styles["payment"]}>{headline.payment}</p>}
      </div>
      <ActionButton
        label={headline === null ? t("See why") : t("See the audit")}
        onPress={onShowAudit}
        variant="paper"
      />
    </div>
  );
}
