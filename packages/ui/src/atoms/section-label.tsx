import styles from "./section-label.module.css";

export interface SectionLabelProps {
  readonly children: string;
}

export function SectionLabel({ children }: SectionLabelProps) {
  return <p className={styles["label"]}>{children.toUpperCase()}</p>;
}
