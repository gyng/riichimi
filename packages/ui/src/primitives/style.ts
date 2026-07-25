import type { CSSProperties } from "react";

/** A transform step, authored as a list: `[{ translateY: 2 }, { scale: 1.08 }]`. */
export type TransformStep =
  | { readonly rotate: string }
  | { readonly scale: number }
  | { readonly scaleX: number }
  | { readonly scaleY: number }
  | { readonly translateX: number | string }
  | { readonly translateY: number | string };

/**
 * A style object. Plain CSS, with three deliberate widenings for shapes this
 * codebase authors everywhere; `resolveStyle` turns each into real CSS so
 * nothing outside `CSSProperties` reaches the DOM.
 */
export interface Style extends Omit<CSSProperties, "fontWeight" | "transform"> {
  /** CSS numeric weights, plus the quoted form (`"700"`) used across the app. */
  readonly fontWeight?: CSSProperties["fontWeight"] | `${number}`;
  readonly transform?: string | readonly TransformStep[];
  readonly marginHorizontal?: number | string;
  readonly marginVertical?: number | string;
  readonly paddingHorizontal?: number | string;
  readonly paddingVertical?: number | string;
}

/** The shape of a co-located style block: `const styles = { … } satisfies Styles`. */
export type Styles = Record<string, Style>;

/**
 * A `style` prop. Conditionals are written inline (`selected && styles.selected`),
 * so falsy members are expected and skipped.
 */
export type StyleProp = Style | false | null | undefined | readonly StyleProp[];

// A lone `monospace` keyword makes browsers switch to their default fixed-pitch
// size and ignore the authored one; naming it twice defeats that quirk. Kept from
// react-native-web, where the same substitution held the ledger's mono labels at
// the size they are written at.
const MONOSPACE_STACK = "monospace, monospace";

// Horizontal/vertical pairs have no single CSS property, so they always expand.
const AXIS_EDGES = {
  marginHorizontal: ["marginLeft", "marginRight"],
  marginVertical: ["marginTop", "marginBottom"],
  paddingHorizontal: ["paddingLeft", "paddingRight"],
  paddingVertical: ["paddingTop", "paddingBottom"],
} as const satisfies Record<string, readonly string[]>;

// CSS resolves a shorthand against a longhand by declaration order; these style
// blocks are written alphabetically, which puts `borderWidth` after
// `borderLeftWidth` and would silently erase it. Expanding a shorthand whenever
// it collides makes the more specific property win whatever the key order — the
// precedence the styles were written against.
const SHORTHAND_EDGES = {
  borderColor: ["borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"],
  borderRadius: [
    "borderTopLeftRadius",
    "borderTopRightRadius",
    "borderBottomRightRadius",
    "borderBottomLeftRadius",
  ],
  borderStyle: ["borderTopStyle", "borderRightStyle", "borderBottomStyle", "borderLeftStyle"],
  borderWidth: ["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"],
  margin: ["marginTop", "marginRight", "marginBottom", "marginLeft"],
  padding: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
} as const satisfies Record<string, readonly string[]>;

function isAxisShorthand(key: string): key is keyof typeof AXIS_EDGES {
  return Object.hasOwn(AXIS_EDGES, key);
}

function isShorthand(key: string): key is keyof typeof SHORTHAND_EDGES {
  return Object.hasOwn(SHORTHAND_EDGES, key);
}

function transformStepToCss(step: TransformStep): string {
  const [name, value] = Object.entries(step)[0] ?? ["", ""];
  // Scale is a ratio; the rest are lengths, and a bare number means pixels.
  const unit = typeof value === "number" && !name.startsWith("scale") ? "px" : "";
  return `${name}(${String(value)}${unit})`;
}

function toCssValue(key: string, value: unknown): unknown {
  // React treats a bare `lineHeight` number as a multiple of the font size,
  // where these styles mean pixels — 28 line heights depend on the difference.
  if (key === "lineHeight" && typeof value === "number") {
    return `${value}px`;
  }
  if (key === "fontFamily" && value === "monospace") {
    return MONOSPACE_STACK;
  }
  if (key === "transform" && Array.isArray(value)) {
    return (value as readonly TransformStep[]).map(transformStepToCss).join(" ");
  }
  return value;
}

function flatten(style: StyleProp, into: Record<string, unknown>): void {
  if (style === false || style === null || style === undefined) {
    return;
  }
  if (Array.isArray(style)) {
    for (const member of style) {
      flatten(member, into);
    }
    return;
  }
  Object.assign(into, style);
}

/**
 * Collapse a `style` prop into the CSS the DOM should receive: later members of
 * an array win, non-CSS shorthands expand, and specific properties beat broad
 * ones regardless of the order they were written in.
 */
export function resolveStyle(style: StyleProp): CSSProperties {
  const authored: Record<string, unknown> = {};
  flatten(style, authored);

  const resolved: Record<string, unknown> = {};
  const collisionCandidates: (keyof typeof SHORTHAND_EDGES)[] = [];

  for (const [key, value] of Object.entries(authored)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (isAxisShorthand(key)) {
      for (const edge of AXIS_EDGES[key]) {
        // An edge written out by hand is the more specific choice; leave it.
        const explicit = authored[edge];
        if (explicit === undefined || explicit === null) {
          resolved[edge] = toCssValue(edge, value);
        }
      }
      continue;
    }
    if (isShorthand(key)) {
      collisionCandidates.push(key);
      continue;
    }
    resolved[key] = toCssValue(key, value);
  }

  // Last, so every edge an axis shorthand or an explicit longhand contributed is
  // already visible and can be recognised as a collision.
  for (const key of collisionCandidates) {
    const value = authored[key];
    const edges = SHORTHAND_EDGES[key];
    if (edges.every((edge) => resolved[edge] === undefined)) {
      resolved[key] = toCssValue(key, value);
      continue;
    }
    for (const edge of edges) {
      if (resolved[edge] === undefined) {
        resolved[edge] = toCssValue(edge, value);
      }
    }
  }

  return resolved;
}
