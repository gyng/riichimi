import { useEffect, useMemo, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";

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

// A brush-calligraphy stamp of the limit, painted over the fire and revealed one
// stroke-heavy character at a time — each landing with a shockwave ring and a
// struck-bell hit, harder the bigger the hand. Decorative and time-limited; it
// fades to reveal the score it is celebrating.
export function CelebrationBanner({ celebration }: CelebrationBannerProps) {
  const progress = useRef(new Animated.Value(0)).current;
  // The terms are all single-unit (BMP) glyphs, so a plain split is correct.
  const chars = useMemo(() => termFor(celebration.limit).split(""), [celebration.limit]);
  const { ink, halo } = palette(celebration.tier);

  const total = celebration.durationMs;
  // Characters reveal across the first stretch of the timeline, spaced so they
  // always fit before the hold-and-fade — whatever the duration or count.
  const startFraction = (index: number): number =>
    chars.length <= 1 ? 0 : (index / chars.length) * 0.55;
  const fontSize = Math.min(148, Math.floor((330 / chars.length) * 1.05));
  const cell = fontSize * 1.14;

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const strength = Math.min(celebration.tier / 7, 1);

    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) {
        return;
      }
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
      const reveal = Animated.timing(progress, {
        duration: reduce ? 520 : total,
        easing: reduce ? Easing.linear : Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      });
      reveal.start();
    });

    return () => {
      cancelled = true;
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [celebration, progress, chars, total]);

  // The whole stamp fades out at the end, uncovering the score beneath.
  const rootOpacity = progress.interpolate({ inputRange: [0, 0.78, 1], outputRange: [1, 1, 0] });
  const burstMax = 1.7 + celebration.tier * 0.16;
  const burstPeak = Math.min(0.62, 0.4 + celebration.tier * 0.05);
  const popFrom = 1.5 + celebration.tier * 0.09;

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.root, { opacity: rootOpacity }]}
    >
      <View style={styles.row}>
        {chars.map((character, index) => {
          const start = startFraction(index);
          const opacity = progress.interpolate({
            inputRange: [start, start + 0.05, 1],
            outputRange: [0, 1, 1],
            extrapolate: "clamp",
          });
          const scale = progress.interpolate({
            inputRange: [start, start + 0.04, start + 0.11],
            outputRange: [popFrom, 0.84, 1],
            extrapolate: "clamp",
          });
          const burstScale = progress.interpolate({
            inputRange: [start, start + 0.18],
            outputRange: [0.2, burstMax],
            extrapolate: "clamp",
          });
          const burstOpacity = progress.interpolate({
            inputRange: [start, start + 0.03, start + 0.2],
            outputRange: [0, burstPeak, 0],
            extrapolate: "clamp",
          });
          return (
            <View key={index} style={[styles.cell, { height: cell, width: cell }]}>
              <Animated.View
                style={[
                  styles.burst,
                  {
                    borderColor: ink,
                    height: cell,
                    opacity: burstOpacity,
                    transform: [{ scale: burstScale }],
                    width: cell,
                  },
                ]}
              />
              <Animated.Text
                style={[
                  styles.char,
                  {
                    color: ink,
                    fontSize,
                    opacity,
                    textShadowColor: halo,
                    textShadowRadius: 12 + celebration.tier * 3,
                    transform: [{ scale }],
                  },
                ]}
              >
                {character}
              </Animated.Text>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  burst: {
    borderRadius: 999,
    borderWidth: 3,
    position: "absolute",
  },
  cell: { alignItems: "center", justifyContent: "center" },
  char: {
    fontFamily: "YujiBoku",
    textAlign: "center",
    textShadowOffset: { height: 0, width: 0 },
  },
  root: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  row: { alignItems: "center", flexDirection: "row", justifyContent: "center" },
});
