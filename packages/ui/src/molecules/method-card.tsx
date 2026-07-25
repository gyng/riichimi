import { ActionButton } from "../atoms/action-button";
import { classNames } from "../class-names";
import styles from "./method-card.module.css";

export interface MethodCardProps {
  readonly actionLabel: string;
  readonly body: string;
  readonly index: string;
  readonly onPress: () => void;
  readonly primary?: boolean;
  readonly title: string;
}

export function MethodCard({
  actionLabel,
  body,
  index,
  onPress,
  primary = false,
  title,
}: MethodCardProps) {
  return (
    <div className={classNames(styles["card"], primary && styles["primary"])}>
      <div className={styles["headingRow"]}>
        {/* Decorative: the title below already names the method. */}
        <p aria-hidden className={styles["index"]}>
          {index}
        </p>
        <div className={styles["rule"]} />
      </div>
      <h2 className={styles["title"]}>{title}</h2>
      <p className={styles["body"]}>{body}</p>
      <ActionButton
        label={actionLabel}
        onPress={onPress}
        variant={primary ? "vermilion" : "paper"}
      />
    </div>
  );
}
