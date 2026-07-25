import { classNames } from "../class-names";
import styles from "./checkbox.module.css";

export interface CheckboxProps {
  readonly checked: boolean;
  /** A rule pinned to a running table, say: visible, stated, and not editable. */
  readonly disabled?: boolean;
  /** Layout from the caller — a margin, or a place in a grid. */
  readonly className?: string | undefined;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}

/**
 * One on-or-off setting, labelled. A `button` with `role="checkbox"` rather than
 * an `input`: the box is drawn rather than native, and the whole row is the
 * target. It reports the value it is moving to, so callers never re-derive it.
 */
export function Checkbox({ checked, className, disabled = false, label, onChange }: CheckboxProps) {
  return (
    <button
      aria-checked={checked}
      className={classNames(styles["row"], className)}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="checkbox"
      type="button"
    >
      <span aria-hidden className={classNames(styles["box"], checked && styles["boxChecked"])} />
      <span className={styles["label"]}>{label}</span>
    </button>
  );
}
