import { color } from "@riichimi/ui";
import { useEffect, useMemo, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";

import type { Celebration } from "./celebration";

export interface CelebrationOverlayProps {
  readonly celebration: Celebration;
  readonly onDone: () => void;
}

interface Spark {
  readonly angle: number;
  readonly distance: number;
  readonly size: number;
  readonly ember: boolean;
}

// The web build renders a fire + lightning shader; native has no WebGL, so it
// gets a composited Animated flourish — a vermilion flash, an expanding ring,
// and embers (blue-white for the lightning tiers) — escalating with the tier.
export function CelebrationOverlay({ celebration, onDone }: CelebrationOverlayProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const sparks = useMemo<readonly Spark[]>(() => {
    const count = celebration.tier * 6;
    return Array.from({ length: count }, (_, index) => ({
      angle: (index / count) * Math.PI * 2 + index * 0.6,
      distance: 90 + (index % 5) * 34 + celebration.tier * 12,
      size: 4 + (index % 3) * 2,
      ember: celebration.lightning && index % 3 === 0,
    }));
  }, [celebration]);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!cancelled) {
        // Reduced motion collapses to a brief, still flash — no travel, no flicker.
        const timing = Animated.timing(progress, {
          duration: reduce ? 500 : celebration.durationMs,
          easing: reduce ? Easing.linear : Easing.out(Easing.cubic),
          toValue: reduce ? 0.5 : 1,
          useNativeDriver: true,
        });
        timing.start(() => doneRef.current());
      }
    });
    return () => {
      cancelled = true;
    };
  }, [celebration, progress]);

  const flashOpacity = progress.interpolate({
    inputRange: [0, 0.08, 0.5, 1],
    outputRange: [0, 0.55, 0.12, 0],
  });
  const ringScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.4] });
  const ringOpacity = progress.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.7, 0],
  });

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.root}
    >
      <Animated.View style={[styles.flash, { opacity: flashOpacity }]} />
      <Animated.View
        style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
      />
      {sparks.map((spark, index) => {
        const travel = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, spark.distance],
        });
        return (
          <Animated.View
            key={index}
            style={[
              styles.spark,
              {
                backgroundColor: spark.ember ? "#BFD3FF" : color.accent,
                height: spark.size,
                opacity: progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateX: Animated.multiply(travel, Math.cos(spark.angle)) },
                  { translateY: Animated.multiply(travel, Math.sin(spark.angle)) },
                ],
                width: spark.size,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flash: {
    backgroundColor: color.accent,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  ring: {
    borderColor: "#FFE0A8",
    borderRadius: 90,
    borderWidth: 3,
    height: 180,
    width: 180,
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
  spark: { borderRadius: 4, position: "absolute" },
});
