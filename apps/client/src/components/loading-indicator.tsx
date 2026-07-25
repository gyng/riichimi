import styles from "./loading-indicator.module.css";

/**
 * Work is in progress and cannot say how far along it is. Every screen that waits
 * on storage or the recognizer shows this next to a line saying what it waits for,
 * so the ring itself carries no name.
 */
export function LoadingIndicator() {
  return (
    <svg
      aria-valuemax={1}
      aria-valuemin={0}
      className={styles["ring"]}
      role="progressbar"
      viewBox="0 0 32 32"
    >
      <circle
        className={styles["track"]}
        cx="16"
        cy="16"
        fill="none"
        r="14"
        stroke="var(--color-accent)"
        strokeWidth="4"
      />
      {/* A quarter of the circumference, which is what reads as a turning arc. */}
      <circle
        cx="16"
        cy="16"
        fill="none"
        r="14"
        stroke="var(--color-accent)"
        strokeDasharray={80}
        strokeDashoffset={60}
        strokeWidth="4"
      />
    </svg>
  );
}
