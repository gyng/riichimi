import type { ReactNode } from "react";

import { classNames } from "../class-names";
import styles from "./calculator-landing.module.css";

/** Every user-facing string, supplied by the app so it can be translated. */
export interface CalculatorLandingCopy {
  readonly headline: string;
  readonly historyEmpty: string;
  readonly historyLabel: string;
  readonly manualAction: string;
  readonly scanAction: string;
  readonly sessionResume: string;
  readonly sessionStart: string;
}

export interface CalculatorLandingProps {
  readonly copy: CalculatorLandingCopy;
  readonly hasActiveSession: boolean;
  readonly historyCount: number;
  readonly onHistory: () => void;
  readonly onManual: () => void;
  readonly onScan: () => void;
  readonly onSession: () => void;
  readonly rulesControl?: ReactNode | undefined;
}

export function CalculatorLanding({
  copy,
  hasActiveSession,
  historyCount,
  onHistory,
  onManual,
  onScan,
  onSession,
  rulesControl,
}: CalculatorLandingProps) {
  const folioEmpty = historyCount === 0;

  return (
    <div className={styles["root"]}>
      <h1 className={styles["headline"]}>{copy.headline}</h1>

      <div className={styles["actions"]}>
        <button
          className={classNames(styles["action"], styles["scan"])}
          onClick={onScan}
          type="button"
        >
          {copy.scanAction}
        </button>
        <button
          className={classNames(styles["action"], styles["manual"])}
          onClick={onManual}
          type="button"
        >
          {copy.manualAction}
        </button>
      </div>

      <button
        aria-label={hasActiveSession ? copy.sessionResume : copy.sessionStart}
        className={classNames(styles["row"], hasActiveSession && styles["rowActive"])}
        onClick={onSession}
        type="button"
      >
        <span className={styles["rowLabel"]}>
          {hasActiveSession ? copy.sessionResume : copy.sessionStart}
        </span>
        <span aria-hidden className={styles["rowArrow"]}>
          →
        </span>
      </button>

      {/* Named explicitly: the count is written as a ledger figure ("03"), which
          reads aloud as "zero three" if it lands in the accessible name. */}
      <button
        aria-label={folioEmpty ? copy.historyEmpty : copy.historyLabel}
        className={styles["row"]}
        disabled={folioEmpty}
        onClick={onHistory}
        type="button"
      >
        <span className={styles["rowLabel"]}>
          {folioEmpty ? copy.historyEmpty : copy.historyLabel}
        </span>
        {folioEmpty ? null : (
          <span aria-hidden className={styles["rowCount"]}>
            {String(historyCount).padStart(2, "0")}
          </span>
        )}
      </button>

      {rulesControl}
    </div>
  );
}
