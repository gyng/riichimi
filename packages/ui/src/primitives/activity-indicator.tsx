import { useEffect, useRef } from "react";

import { resolveStyle } from "./style";
import type { Style, StyleProp } from "./style";

export interface ActivityIndicatorProps {
  readonly color?: string;
  readonly size?: number;
  readonly style?: StyleProp;
}

const CONTAINER_BASE = {
  alignItems: "center",
  display: "flex",
  justifyContent: "center",
} as const satisfies Style;

const SPIN = [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }];
const SPIN_TIMING: KeyframeAnimationOptions = {
  duration: 750,
  easing: "linear",
  iterations: Number.POSITIVE_INFINITY,
};

/**
 * An indeterminate progress ring: a faint full circle with a brighter arc turning
 * over it. Reported as a `progressbar` with no value, because the work it covers
 * — opening a table, reading tile faces — has no measurable progress.
 */
export function ActivityIndicator({ color = "#1976D2", size = 20, style }: ActivityIndicatorProps) {
  const ring = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const node = ring.current;
    // `animate` is absent under jsdom, where a still ring is all a test can
    // observe anyway.
    const animation =
      node === null || typeof node.animate !== "function" ? null : node.animate(SPIN, SPIN_TIMING);
    return () => animation?.cancel();
  }, []);

  return (
    <div
      aria-valuemax={1}
      aria-valuemin={0}
      role="progressbar"
      style={{ ...CONTAINER_BASE, ...resolveStyle(style) }}
    >
      <span ref={ring} style={{ display: "block", height: size, width: size }}>
        <svg height="100%" viewBox="0 0 32 32" width="100%">
          <circle cx="16" cy="16" fill="none" opacity={0.2} r="14" stroke={color} strokeWidth="4" />
          <circle
            cx="16"
            cy="16"
            fill="none"
            r="14"
            stroke={color}
            strokeDasharray={80}
            strokeDashoffset={60}
            strokeWidth="4"
          />
        </svg>
      </span>
    </div>
  );
}
