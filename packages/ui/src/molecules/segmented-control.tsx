import { classNames } from "../class-names";
import styles from "./segmented-control.module.css";

export interface SegmentOption<Value extends string> {
  readonly label: string;
  readonly value: Value;
}

export interface SegmentedControlProps<Value extends string> {
  readonly accessibilityLabel: string;
  readonly onChange: (value: Value) => void;
  readonly options: readonly SegmentOption<Value>[];
  readonly value: Value;
}

export function SegmentedControl<Value extends string>({
  accessibilityLabel,
  onChange,
  options,
  value,
}: SegmentedControlProps<Value>) {
  return (
    <div aria-label={accessibilityLabel} className={styles["root"]} role="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            aria-checked={selected}
            className={classNames(styles["option"], selected && styles["selected"])}
            key={option.value}
            onClick={() => onChange(option.value)}
            role="radio"
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
