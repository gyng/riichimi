import type { ComponentPropsWithRef } from "react";

import { BOX_BASE } from "./base-style";
import { resolveStyle } from "./style";
import type { StyleProp } from "./style";

export interface ScrollViewProps extends Omit<ComponentPropsWithRef<"div">, "style"> {
  /** Styles the inner track that holds the content, not the scrolling window. */
  readonly contentContainerStyle?: StyleProp;
  readonly style?: StyleProp;
}

// The window grows and shrinks with its parent and scrolls vertically only;
// sideways overflow is clipped so a wide row cannot push the page off-screen.
const SCROLL_BASE = {
  flexGrow: 1,
  flexShrink: 1,
  overflowX: "hidden",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
} as const satisfies StyleProp;

/**
 * A vertically scrolling region. Two boxes, because the scrolling window and the
 * content it scrolls need separate padding: the window must not pad its
 * scrollbar, and the content must be able to run past the fold.
 */
export function ScrollView({ children, contentContainerStyle, style, ...rest }: ScrollViewProps) {
  return (
    <div {...rest} style={{ ...BOX_BASE, ...SCROLL_BASE, ...resolveStyle(style) }}>
      <div style={{ ...BOX_BASE, ...resolveStyle(contentContainerStyle) }}>{children}</div>
    </div>
  );
}
