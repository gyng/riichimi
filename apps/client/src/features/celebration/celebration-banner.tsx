import { color } from "@riichimi/ui";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet } from "react-native";

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
  // Triple / quadruple / Nx yakuman all read as 役満 at the peak of the scale.
  return TERMS[limit] ?? "役満";
}

// A brush-calligraphy stamp of the limit, painted over the fire. Purely
// decorative and time-limited; it fades to reveal the score it is celebrating.
export function CelebrationBanner({ celebration }: CelebrationBannerProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!cancelled) {
        const timing = Animated.timing(progress, {
          duration: celebration.durationMs,
          easing: reduce ? Easing.linear : Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        });
        timing.start();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [celebration, progress]);

  const opacity = progress.interpolate({
    inputRange: [0, 0.12, 0.72, 1],
    outputRange: [0, 1, 1, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [1.35, 1, 1.12],
  });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.root, { opacity, transform: [{ scale }] }]}
    >
      <Animated.Text adjustsFontSizeToFit numberOfLines={1} style={styles.term}>
        {termFor(celebration.limit)}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    paddingHorizontal: 24,
    position: "absolute",
    right: 0,
    top: 0,
  },
  term: {
    color: color.accent,
    fontFamily: "YujiSyuku",
    fontSize: 132,
    textAlign: "center",
    textShadowColor: "rgba(255,244,232,0.9)",
    textShadowOffset: { height: 0, width: 0 },
    textShadowRadius: 18,
  },
});
