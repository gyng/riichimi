import { Text, View } from "@riichimi/ui";
import type { Styles } from "@riichimi/ui";
import { useEffect, useMemo, useRef, useState } from "react";

import { chime } from "./chime";
import type { Celebration } from "./celebration";

export interface CelebrationBannerProps {
  readonly celebration: Celebration;
}

// The limit written the way it is called at the table, in kanji, for the brush.
const TERMS: Readonly<Record<string, string>> = {
  mangan: "満貫",
  haneman: "跳満",
  baiman: "倍満",
  sanbaiman: "三倍満",
  yonbaiman: "数え役満",
  yakuman: "役満",
  "double yakuman": "ダブル役満",
};

// The cubic ease-out the reveal has always run on, as its Bézier equivalent. It
// eases the timeline once; every keyframe list below is read against that eased
// progress, which is what keeps the characters in step with each other.
const EASE_OUT_CUBIC = "cubic-bezier(0.215, 0.61, 0.355, 1)";

function termFor(limit: string): string {
  return TERMS[limit] ?? "役満";
}

// Colour carries the escalation: vermilion for the smaller limits, a hotter red
// through the counted ones, gold once a hand reaches yakuman.
function palette(tier: number): { readonly ink: string; readonly halo: string } {
  if (tier >= 6) {
    return { ink: "#E8B23A", halo: "rgba(255,236,170,0.95)" };
  }
  if (tier >= 4) {
    return { ink: "#D23B18", halo: "rgba(255,224,180,0.92)" };
  }
  return { ink: "#B63824", halo: "rgba(255,244,232,0.9)" };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Stop = readonly [offset: number, value: number | string];

/**
 * Turn timeline stops into keyframes, held flat outside the stretch they cover.
 * Values before the first stop and after the last one stay put — which is what a
 * reveal that has not started, or has already landed, should do.
 */
function keyframes(property: "opacity" | "transform", stops: readonly Stop[]): Keyframe[] {
  const held = [...stops];
  const first = held.at(0);
  const last = held.at(-1);
  if (first !== undefined && first[0] > 0) {
    held.unshift([0, first[1]]);
  }
  if (last !== undefined && last[0] < 1) {
    held.push([1, last[1]]);
  }
  return held.map(([offset, value]) => ({ offset, [property]: value }));
}

function animate(
  node: HTMLElement | null,
  property: "opacity" | "transform",
  stops: readonly Stop[],
  timing: KeyframeAnimationOptions,
): Animation | null {
  // Absent under jsdom. The banner is decorative, so a still stamp is no loss.
  if (node === null || typeof node.animate !== "function") {
    return null;
  }
  return node.animate(keyframes(property, stops), timing);
}

interface StampProps {
  readonly burstMax: number;
  readonly burstPeak: number;
  readonly cell: number;
  readonly character: string;
  readonly fontSize: number;
  readonly glow: number;
  readonly halo: string;
  readonly ink: string;
  readonly popFrom: number;
  /** Where on the shared timeline this character lands. */
  readonly start: number;
  readonly timing: KeyframeAnimationOptions;
}

/**
 * One character of the stamp: twin shockwave rings that expand and fade, and the
 * glyph itself snapping back from an overshoot. Rings and glyph read the same
 * timeline, so a ring is always the impact of its own character landing.
 */
function Stamp({
  burstMax,
  burstPeak,
  cell,
  character,
  fontSize,
  glow,
  halo,
  ink,
  popFrom,
  start,
  timing,
}: StampProps) {
  const outerRing = useRef<HTMLDivElement | null>(null);
  const innerRing = useRef<HTMLDivElement | null>(null);
  const glyphs = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ring = (node: HTMLDivElement | null, peak: number, factor: number) => [
      animate(
        node,
        "opacity",
        [
          [start, 0],
          [start + 0.03, peak],
          [start + 0.22, 0],
        ],
        timing,
      ),
      animate(
        node,
        "transform",
        [
          [start, "scale(0.2)"],
          [start + 0.2, `scale(${burstMax * factor})`],
        ],
        timing,
      ),
    ];

    const running = [
      ...ring(outerRing.current, burstPeak * 0.6, 1.35),
      ...ring(innerRing.current, burstPeak, 1),
      animate(
        glyphs.current,
        "opacity",
        [
          [start, 0],
          [start + 0.05, 1],
        ],
        timing,
      ),
      animate(
        glyphs.current,
        "transform",
        [
          [start, `scale(${popFrom})`],
          [start + 0.04, "scale(0.84)"],
          [start + 0.11, "scale(1)"],
        ],
        timing,
      ),
    ];

    return () => {
      for (const animation of running) {
        animation?.cancel();
      }
    };
  }, [burstMax, burstPeak, popFrom, start, timing]);

  return (
    <View style={[styles.cell, { height: cell, width: cell }]}>
      {/* Twin shockwave rings — the outer one wider and softer. */}
      <View
        ref={outerRing}
        style={[styles.ring, { borderColor: halo, height: cell, width: cell }]}
      />
      <View
        ref={innerRing}
        style={[styles.ring, { borderColor: ink, height: cell, width: cell }]}
      />
      {/* An ink outline sits under the coloured fill so the stroke reads as
          brushed and dimensional rather than a flat silhouette. */}
      <View ref={glyphs} style={[styles.stack, { transform: `scale(${popFrom})` }]}>
        <Text style={[styles.layer, styles.outline, { fontSize, lineHeight: cell }]}>
          {character}
        </Text>
        <Text
          style={[
            styles.layer,
            { color: ink, fontSize, lineHeight: cell, textShadow: `0 0 ${glow}px ${halo}` },
          ]}
        >
          {character}
        </Text>
      </View>
    </View>
  );
}

// A brush-calligraphy stamp of the limit, painted over the fire and revealed one
// stroke-heavy character at a time — each landing with a shockwave ring and a
// struck-bell hit, harder the bigger the hand. Decorative and time-limited; it
// fades to reveal the score it is celebrating.
export function CelebrationBanner({ celebration }: CelebrationBannerProps) {
  const root = useRef<HTMLDivElement | null>(null);
  // The terms are all single-unit (BMP) glyphs, so a plain split is correct.
  const chars = useMemo(() => termFor(celebration.limit).split(""), [celebration.limit]);
  const { ink, halo } = palette(celebration.tier);
  // Read once: a player who turns motion off mid-celebration should not have the
  // stamp restart under them.
  const [reduce] = useState(prefersReducedMotion);

  const total = celebration.durationMs;
  // Characters reveal across the first stretch of the timeline, spaced so they
  // always fit before the hold-and-fade — whatever the duration or count.
  const startFraction = (index: number): number =>
    chars.length <= 1 ? 0 : (index / chars.length) * 0.55;
  const fontSize = Math.min(148, Math.floor((330 / chars.length) * 1.05));
  const cell = fontSize * 1.14;

  // One timing shared by every element, so they run off a single eased timeline.
  // Filled both ways: the stamp starts hidden and stays faded once it has gone.
  const timing = useMemo<KeyframeAnimationOptions>(
    () => ({
      duration: reduce ? 520 : total,
      easing: reduce ? "linear" : EASE_OUT_CUBIC,
      fill: "both",
    }),
    [reduce, total],
  );

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const strength = Math.min(celebration.tier / 7, 1);

    if (reduce) {
      if (chime.available) {
        chime.strike(strength);
      }
    } else {
      chars.forEach((_, index) => {
        const timer = setTimeout(
          () => {
            // Later characters ring a touch harder, cresting on the last.
            if (!cancelled && chime.available) {
              chime.strike(strength * (0.72 + 0.28 * ((index + 1) / chars.length)));
            }
          },
          (chars.length <= 1 ? 0 : (index / chars.length) * 0.55) * total + 40,
        );
        timers.push(timer);
      });
    }

    return () => {
      cancelled = true;
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [celebration, chars, reduce, total]);

  // The whole stamp fades out at the end, uncovering the score beneath.
  useEffect(() => {
    const fade = animate(
      root.current,
      "opacity",
      [
        [0, 1],
        [0.78, 1],
        [1, 0],
      ],
      timing,
    );
    return () => fade?.cancel();
  }, [timing]);

  const burstMax = 1.6 + celebration.tier * 0.2;
  const burstPeak = Math.min(0.65, 0.4 + celebration.tier * 0.055);
  const popFrom = 1.5 + celebration.tier * 0.12;
  const glow = 14 + celebration.tier * 4;

  return (
    <View aria-hidden ref={root} style={styles.root}>
      <View style={styles.row}>
        {chars.map((character, index) => (
          <Stamp
            burstMax={burstMax}
            burstPeak={burstPeak}
            cell={cell}
            character={character}
            fontSize={fontSize}
            glow={glow}
            halo={halo}
            ink={ink}
            key={index}
            popFrom={popFrom}
            start={startFraction(index)}
            timing={timing}
          />
        ))}
      </View>
    </View>
  );
}

const styles = {
  cell: { alignItems: "center", justifyContent: "center" },
  layer: {
    bottom: 0,
    fontFamily: "YujiBoku",
    left: 0,
    position: "absolute",
    right: 0,
    textAlign: "center",
    top: 0,
  },
  outline: { color: "#160F0B", transform: "scale(1.08)" },
  // Starts invisible so the first painted frame is not a flash of the full-size
  // ring before its animation takes hold.
  ring: { borderRadius: 999, borderWidth: 4, opacity: 0, position: "absolute" },
  root: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    // Decorative: never intercept a press meant for the score underneath.
    pointerEvents: "none",
    position: "absolute",
    right: 0,
    top: 0,
  },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "center" },
  stack: { bottom: 0, left: 0, opacity: 0, position: "absolute", right: 0, top: 0 },
} satisfies Styles;
