import styles from "./counter-control.module.css";

export interface CounterControlProps {
  readonly label: string;
  readonly maximum?: number;
  readonly minimum?: number;
  readonly onChange: (value: number) => void;
  readonly value: number;
}

export function CounterControl({
  label,
  maximum = 99,
  minimum = 0,
  onChange,
  value,
}: CounterControlProps) {
  return (
    <div className={styles["root"]}>
      <p className={styles["label"]}>{label}</p>
      <div className={styles["controls"]}>
        <button
          aria-label={`Decrease ${label}`}
          className={styles["step"]}
          disabled={value <= minimum}
          onClick={() => onChange(value - 1)}
          type="button"
        >
          −
        </button>
        <p aria-label={`${label}: ${value}`} className={styles["value"]}>
          {value}
        </p>
        <button
          aria-label={`Increase ${label}`}
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
