import { classNames } from "../class-names";
import styles from "./segmented-control.module.css";

export interface SegmentOption<Value extends string> {
  readonly label: string;
  readonly value: Value;
}

/**
 * How the group is named. Exactly one of the two, because a control that both
 * points at a visible label and carries its own overrides the visible one — and
 * then the same words are authored, and translated, twice.
 */
type SegmentedControlNaming =
  | {
      /** The id of the visible label above the group. Prefer this. */
      readonly labelledBy: string;
      readonly accessibilityLabel?: never;
    }
  | {
      /** Names the group where nothing visible already does. */
      readonly accessibilityLabel: string;
      readonly labelledBy?: never;
    };

export type SegmentedControlProps<Value extends string> = SegmentedControlNaming & {
  readonly onChange: (value: Value) => void;
  readonly options: readonly SegmentOption<Value>[];
  readonly value: Value;
};

export function SegmentedControl<Value extends string>({
  accessibilityLabel,
  labelledBy,
  onChange,
  options,
  value,
}: SegmentedControlProps<Value>) {
  return (
    <div
      aria-label={accessibilityLabel}
      aria-labelledby={labelledBy}
      className={styles["root"]}
      role="radiogroup"
    >
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
