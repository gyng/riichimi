import { useId } from "react";

import styles from "./counter-control.module.css";

export interface CounterControlProps {
  /** Names the step-down button. Defaults to English; pass a translated name. */
  readonly decreaseLabel?: string;
  /** Names the step-up button. Defaults to English; pass a translated name. */
  readonly increaseLabel?: string;
  readonly label: string;
  readonly maximum?: number;
  readonly minimum?: number;
  readonly onChange: (value: number) => void;
  readonly value: number;
}

/**
 * A small number a player nudges rather than types. The group takes its name from
 * the visible label, so the readout is heard in context, and the readout is a live
 * region — pressing a stepper should say what the number became.
 */
export function CounterControl({
  decreaseLabel,
  increaseLabel,
  label,
  maximum = 99,
  minimum = 0,
  onChange,
  value,
}: CounterControlProps) {
  const labelId = useId();

  return (
    <div aria-labelledby={labelId} className={styles["root"]} role="group">
      <p className={styles["label"]} id={labelId}>
        {label}
      </p>
      <div className={styles["controls"]}>
        <button
          aria-label={decreaseLabel ?? `Decrease ${label}`}
          className={styles["step"]}
          disabled={value <= minimum}
          onClick={() => onChange(value - 1)}
          type="button"
        >
          −
        </button>
        <p aria-live="polite" className={styles["value"]}>
          {value}
        </p>
        <button
          aria-label={increaseLabel ?? `Increase ${label}`}
          className={styles["step"]}
          disabled={value >= maximum}
          onClick={() => onChange(value + 1)}
          type="button"
        >
          +
        </button>
      </div>
    </div>
  );
}
