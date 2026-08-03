import type { ReactNode } from "react";

import { useEffect, useRef } from "react";

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
  const active = useRef<HTMLButtonElement | null>(null);
  const activeKey = items.find((item) => item.active)?.key;

  // Below the phone breakpoint the destinations scroll, so the one you are on
  // can sit past the fade with nothing to say it is there. Bringing it into
  // view is the difference between a row that looks like four destinations and
  // one that looks like the row it is.
  useEffect(() => {
    const item = active.current;
    // Absent under jsdom, and the bar is perfectly usable without it.
    if (typeof item?.scrollIntoView === "function") {
      item.scrollIntoView({ block: "nearest", inline: "center" });
    }
  }, [activeKey]);

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
            ref={item.active ? active : undefined}
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

export interface TopAppBarChoice {
  readonly label: string;
  readonly value: string;
}

/**
 * A short list the bar carries permanently — a language, not a destination.
 *
 * A native select rather than a custom menu: it arrives with a keyboard path, a
 * screen-reader contract, and the platform's own picker on a phone, none of which
 * a hand-built popover gets for free. The closed control shows the current choice,
 * so the state is visible without being asked for.
 */
export function TopAppBarSelect({
  label,
  onChange,
  options,
  value,
}: {
  /** The accessible name. The control shows a value, never its own label. */
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly TopAppBarChoice[];
  readonly value: string;
}) {
  return (
    <span className={styles["selectShell"]}>
      <select
        aria-label={label}
        className={styles["select"]}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
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
