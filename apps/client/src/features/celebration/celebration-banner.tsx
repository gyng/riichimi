import { classNames } from "@riichimi/ui";
import { useEffect, useMemo, useRef, useState } from "react";

import { chime } from "./chime";
import type { Celebration } from "./celebration";
import styles from "./celebration-banner.module.css";

export interface CelebrationBannerProps {
  readonly celebration: Celebration;
}

// The cubic ease-out the reveal has always run on, as its Bézier equivalent. It
// eases the timeline once; every keyframe list below is read against that eased
// progress, which is what keeps the characters in step with each other.
const EASE_OUT_CUBIC = "cubic-bezier(0.215, 0.61, 0.355, 1)";

/**
 * Colour carries the escalation, and it now steps on every rung rather than
 * twice: mangan, haneman and baiman used to share one vermilion, which is where
 * most celebrations live and so where the difference was least visible.
 */
function palette(tier: number): { readonly ink: string; readonly halo: string } {
  if (tier >= 8) {
    return { ink: "#F3D169", halo: "rgba(255,246,206,1)" };
  }
  if (tier >= 6) {
    return { ink: "#E8B23A", halo: "rgba(255,236,170,0.95)" };
  }
  if (tier >= 5) {
    return { ink: "#D9601C", halo: "rgba(255,228,186,0.93)" };
  }
  if (tier >= 4) {
    return { ink: "#D23B18", halo: "rgba(255,224,180,0.92)" };
  }
  if (tier >= 3) {
    return { ink: "#C43220", halo: "rgba(255,236,214,0.9)" };
  }
  if (tier >= 2) {
    return { ink: "#B63824", halo: "rgba(255,244,232,0.9)" };
  }
  return { ink: "#9E3521", halo: "rgba(255,248,240,0.86)" };
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
  readonly character: string;
  /** The last character completes the word, and lands harder than the rest. */
  readonly climax: boolean;
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
  character,
  climax,
  glow,
  halo,
  ink,
  popFrom,
  start,
  timing,
}: StampProps) {
  // Every character used to land identically, so the one that completes the
  // word — the whole point of the reveal — arrived like the first.
  const weight = climax ? 1.45 : 1;
  const settle = climax ? 0.16 : 0.11;
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
          [start + 0.2, `scale(${burstMax * factor * weight})`],
        ],
        timing,
      ),
    ];

    const running = [
      ...ring(outerRing.current, burstPeak * 0.6 * weight, 1.35),
      ...ring(innerRing.current, Math.min(1, burstPeak * weight), 1),
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
          [start, `scale(${popFrom * weight})`],
          [start + 0.04, `scale(${climax ? 0.78 : 0.84})`],
          [start + settle, "scale(1)"],
        ],
        timing,
      ),
    ];

    return () => {
      for (const animation of running) {
        animation?.cancel();
      }
    };
  }, [burstMax, burstPeak, climax, popFrom, settle, start, timing, weight]);

  return (
    <div className={styles["cell"]}>
      {/* Twin shockwave rings — the outer one wider and softer. */}
      <div className={styles["ring"]} ref={outerRing} style={{ borderColor: halo }} />
      <div className={styles["ring"]} ref={innerRing} style={{ borderColor: ink }} />
      {/* An ink outline sits under the coloured fill so the stroke reads as
          brushed and dimensional rather than a flat silhouette. */}
      <div className={styles["stack"]} ref={glyphs} style={{ transform: `scale(${popFrom})` }}>
        <span className={classNames(styles["layer"], styles["outline"])}>{character}</span>
        <span
          className={styles["layer"]}
          style={{ color: ink, textShadow: `0 0 ${String(glow)}px ${halo}` }}
        >
          {character}
        </span>
      </div>
    </div>
  );
}

// A brush-calligraphy stamp of the limit, painted over the fire and revealed one
// stroke-heavy character at a time — each landing with a shockwave ring and a
// struck-bell hit, harder the bigger the hand. Decorative and time-limited; it
// fades to reveal the score it is celebrating.
export function CelebrationBanner({ celebration }: CelebrationBannerProps) {
  const root = useRef<HTMLDivElement | null>(null);
  // The terms are all single-unit (BMP) glyphs, so a plain split is correct.
  const chars = useMemo(() => celebration.term.split(""), [celebration.term]);
  const { ink, halo } = palette(celebration.tier);
  // Read once: a player who turns motion off mid-celebration should not have the
  // stamp restart under them.
  const [reduce] = useState(prefersReducedMotion);

  const total = celebration.durationMs;
  // A fixed silence between characters, taken from the tier. The old spacing
  // divided one stretch of the timeline among however many characters there
  // were, so a longer word — which is always a bigger hand — read faster.
  const startFractions = useMemo(
    () =>
      chars.map(
        (_, index) =>
          (celebration.climaxAtMs - celebration.gapMs * (chars.length - 1 - index)) / total,
      ),
    [celebration.climaxAtMs, celebration.gapMs, chars, total],
  );

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
      // Still escalates: the bell is not motion, and neither is holding a
      // bigger hand on screen for longer.
      if (chime.available) {
        chime.strike(strength, { deep: true });
      }
    } else {
      chars.forEach((_, index) => {
        const climax = index === chars.length - 1;
        const timer = setTimeout(
          () => {
            // Later characters ring harder, and the one that completes the word
            // rings deepest — an octave under, held longer.
            if (!cancelled && chime.available) {
              chime.strike(strength * (0.72 + 0.28 * ((index + 1) / chars.length)), {
                deep: climax,
              });
            }
          },
          (startFractions[index] ?? 0) * total + 40,
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
  }, [celebration, chars, reduce, startFractions, total]);

  // The whole stamp fades out at the end, uncovering the score beneath. The
  // hold before it is a fixed length rather than a fraction, so a bigger hand
  // stays up longer instead of merely fading more slowly.
  const fadeFraction = 520 / total;
  useEffect(() => {
    const fade = animate(
      root.current,
      "opacity",
      [
        [0, 1],
        [1 - fadeFraction, 1],
        [1, 0],
      ],
      timing,
    );
    return () => fade?.cancel();
  }, [fadeFraction, timing]);

  const burstMax = 1.6 + celebration.tier * 0.2;
  const burstPeak = Math.min(0.65, 0.4 + celebration.tier * 0.055);
  const popFrom = 1.5 + celebration.tier * 0.12;
  const glow = 14 + celebration.tier * 4;

  return (
    <div aria-hidden className={styles["root"]} ref={root}>
      {/* The row carries the type size; every part of a stamp is sized from it. */}
      <div className={styles["row"]} style={{ fontSize: celebration.fontSize }}>
        {chars.map((character, index) => (
          <Stamp
            burstMax={burstMax}
            burstPeak={burstPeak}
            character={character}
            climax={index === chars.length - 1}
            glow={glow}
            halo={halo}
            ink={ink}
            key={index}
            popFrom={popFrom}
            start={startFractions[index] ?? 0}
            timing={timing}
          />
        ))}
      </div>
    </div>
  );
}
