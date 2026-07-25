import type { CSSProperties } from "react";

// The system stack a bare `System` font family used to resolve to. Text that
// names no family of its own still renders in it.
const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/*
 * A note on shorthands. These resets are written as longhands on purpose.
 * React clears a style property that disappears between two renders by assigning
 * "", which deletes that component of any shorthand it was part of — and the
 * property then falls back to its CSS initial value, not to what the shorthand
 * said. `border: 0 solid black` plus a cleared `border-width` therefore paints a
 * 3px black frame (`medium`, the initial). Longhands cannot come apart this way.
 */

/**
 * The reset every box starts from. A `div` is `display: block` with a shrinking
 * flex basis; these styles are what the layouts in this app are written against —
 * a column flex container that does not shrink, sized border-box.
 * Authored styles are spread after this, so any of it can be overridden.
 */
export const BOX_BASE: CSSProperties = {
  alignContent: "flex-start",
  alignItems: "stretch",
  backgroundColor: "transparent",
  borderColor: "black",
  borderStyle: "solid",
  borderWidth: 0,
  boxSizing: "border-box",
  display: "flex",
  flexBasis: "auto",
  flexDirection: "column",
  flexShrink: 0,
  listStyle: "none",
  margin: 0,
  minHeight: 0,
  minWidth: 0,
  padding: 0,
  position: "relative",
  textDecoration: "none",
  zIndex: 0,
};

/**
 * The reset for a run of text. Deliberately opaque rather than inheriting: a
 * `Text` states its own colour and font, so a container's typography never leaks
 * into it. `pre-wrap` keeps authored newlines.
 */
export const TEXT_BASE: CSSProperties = {
  backgroundColor: "transparent",
  borderColor: "black",
  borderStyle: "solid",
  borderWidth: 0,
  boxSizing: "border-box",
  color: "black",
  display: "inline",
  fontFamily: SYSTEM_FONT_STACK,
  fontSize: 14,
  fontStyle: "normal",
  fontWeight: "normal",
  listStyle: "none",
  margin: 0,
  padding: 0,
  position: "relative",
  textAlign: "start",
  textDecoration: "none",
  whiteSpace: "pre-wrap",
  wordWrap: "break-word",
};

/**
 * A button arrives wearing browser chrome — its own font, background, border, and
 * centred text — none of which belongs to a pressable box. Focus is left alone so
 * the browser's ring survives.
 */
export const PRESSABLE_BASE: CSSProperties = {
  ...BOX_BASE,
  appearance: "none",
  color: "inherit",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "inherit",
  fontStyle: "inherit",
  fontWeight: "inherit",
  textAlign: "inherit",
};

/** Fields state their own border, radius, and type; this clears the browser's. */
export const INPUT_BASE: CSSProperties = {
  appearance: "none",
  backgroundColor: "transparent",
  borderColor: "black",
  borderRadius: 0,
  borderStyle: "solid",
  borderWidth: 0,
  boxSizing: "border-box",
  margin: 0,
  padding: 0,
};
