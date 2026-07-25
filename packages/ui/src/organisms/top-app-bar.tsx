import type { ReactNode } from "react";

import { classNames } from "../class-names";
import styles from "./top-app-bar.module.css";

export interface TopAppBarItem {
  readonly active: boolean;
  readonly key: string;
  readonly label: string;
  readonly onPress: () => void;
}

export interface TopAppBarProps {
  readonly brandGlyph: string;
  readonly brandLabel: string;
  /** The brand link's accessible name — it goes home, which the wordmark alone
      does not say. Supplied rather than composed here, so it can be translated. */
  readonly homeLabel: string;
  readonly items: readonly TopAppBarItem[];
  /** Names the navigation landmark, for anyone moving by landmark. */
  readonly navLabel: string;
  readonly onBrandPress: () => void;
  readonly trailing?: ReactNode | undefined;
}

/**
 * Persistent tool navigation. The app's primary destinations live here so every
 * surface is one tap away — this is a working tool, not a landing page routed
 * through a hero. Presentational only: it renders items and reports presses.
 *
 * The phone layout is a media query rather than a measured width, so the bar
 * reflows during a resize instead of after one.
 */
export function TopAppBar({
  brandGlyph,
  brandLabel,
  homeLabel,
  items,
  navLabel,
  onBrandPress,
  trailing,
}: TopAppBarProps) {
  return (
    <div className={styles["bar"]}>
      <button
        aria-label={homeLabel}
        className={styles["brand"]}
        onClick={onBrandPress}
        role="link"
        type="button"
      >
        <span aria-hidden className={styles["brandMark"]}>
          {brandGlyph}
        </span>
        <span className={styles["brandLabel"]}>{brandLabel}</span>
      </button>

      <nav aria-label={navLabel} className={styles["nav"]}>
        {items.map((item) => (
          <button
            aria-current={item.active ? "page" : undefined}
            className={classNames(styles["item"], item.active && styles["itemActive"])}
            key={item.key}
            onClick={item.onPress}
            role="link"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>

      {trailing === undefined ? null : <div className={styles["trailing"]}>{trailing}</div>}
    </div>
  );
}

/** A secondary bar destination, set apart from the primary ones. */
export function TopAppBarAction({
  active,
  label,
  onPress,
}: {
  readonly active: boolean;
  readonly label: string;
  readonly onPress: () => void;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className={classNames(styles["item"], active && styles["itemActive"])}
      onClick={onPress}
      role="link"
      type="button"
    >
      {label}
    </button>
  );
}
