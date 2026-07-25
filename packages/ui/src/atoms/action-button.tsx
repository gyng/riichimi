import { classNames } from "../class-names";
import styles from "./action-button.module.css";

export interface ActionButtonProps {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: "ink" | "paper" | "vermilion";
}

export function ActionButton({
  disabled = false,
  label,
  onPress,
  variant = "ink",
}: ActionButtonProps) {
  return (
    <button
      className={classNames(styles["button"], styles[variant])}
      disabled={disabled}
      onClick={onPress}
      type="button"
    >
      {label}
    </button>
  );
}
