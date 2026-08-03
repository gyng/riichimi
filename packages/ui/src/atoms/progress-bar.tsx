import { classNames } from "../class-names";
import styles from "./progress-bar.module.css";

export interface ProgressBarProps {
  /** Names the work, for a reader who cannot see the bar. */
  readonly label: string;
  /**
   * How far along, from 0 to 1. Leave it out when the work cannot say — the bar
   * then shows that something is happening without claiming to know how much is
   * left, which is the honest reading of an unmeasurable wait.
   */
  readonly value?: number | undefined;
}

/**
 * A horizontal measure of work in progress.
 *
 * Separate from the spinner because the two say different things: a spinner
 * says "waiting", a bar says "this much of it is done". A 90 MB download that
 * only says "waiting" is indistinguishable from one that has stalled.
 */
export function ProgressBar({ label, value }: ProgressBarProps) {
  const determinate = value !== undefined && Number.isFinite(value);
  const clamped = determinate ? Math.min(Math.max(value, 0), 1) : 0;

  return (
    <div
      aria-label={label}
      aria-valuemax={1}
      aria-valuemin={0}
      // Omitted while indeterminate: a screen reader should say "busy", not a
      // number the app is guessing at.
      {...(determinate ? { "aria-valuenow": Number(clamped.toFixed(2)) } : {})}
      className={styles["track"]}
      role="progressbar"
    >
      <div
        className={classNames(styles["fill"], determinate ? undefined : styles["indeterminate"])}
        style={determinate ? { width: `${String(clamped * 100)}%` } : undefined}
      />
    </div>
  );
}
