import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";

import { color, space } from "../tokens/theme";

export interface TopAppBarItem {
  readonly active: boolean;
  readonly key: string;
  readonly label: string;
  readonly onPress: () => void;
}

export interface TopAppBarProps {
  readonly brandGlyph: string;
  readonly brandLabel: string;
  readonly items: readonly TopAppBarItem[];
  readonly onBrandPress: () => void;
  readonly trailing?: ReactNode | undefined;
}

/**
 * Persistent tool navigation. The app's primary destinations live here so every
 * surface is one tap away — this is a working tool, not a landing page routed
 * through a hero. Presentational only: it renders items and reports presses.
 */
export function TopAppBar({
  brandGlyph,
  brandLabel,
  items,
  onBrandPress,
  trailing,
}: TopAppBarProps) {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityLabel={`${brandLabel} home`}
        accessibilityRole="link"
        onPress={onBrandPress}
        style={({ pressed }) => [styles.brand, pressed && styles.pressed]}
      >
        <View accessibilityElementsHidden style={styles.brandMark}>
          <Text style={styles.brandGlyph}>{brandGlyph}</Text>
        </View>
        <Text style={styles.brandLabel}>{brandLabel}</Text>
      </Pressable>

      <View accessibilityLabel="Primary" style={styles.nav}>
        {items.map((item) => (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="link"
            accessibilityState={{ selected: item.active }}
            key={item.key}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.item,
              item.active && styles.itemActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.itemLabel, item.active && styles.itemLabelActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {trailing === undefined ? null : <View style={styles.trailing}>{trailing}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    backgroundColor: color.paper,
    borderBottomColor: color.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.x3,
    paddingHorizontal: space.x5,
    paddingVertical: space.x3,
  },
  brand: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.x2,
    marginRight: space.x4,
    minHeight: 44,
  },
  brandGlyph: {
    color: color.white,
    fontFamily: "serif",
    fontSize: 17,
    fontWeight: "700",
  },
  brandLabel: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 2,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: color.accent,
    borderRadius: 3,
    height: 30,
    justifyContent: "center",
    width: 25,
  },
  item: {
    borderBottomColor: "transparent",
    borderBottomWidth: 2,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: space.x2,
  },
  itemActive: {
    borderBottomColor: color.accent,
  },
  itemLabel: {
    color: color.inkMuted,
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  itemLabelActive: {
    color: color.ink,
  },
  nav: {
    alignItems: "center",
    flexDirection: "row",
    flexGrow: 1,
    flexWrap: "wrap",
    gap: space.x1,
  },
  pressed: {
    opacity: 0.7,
  },
  trailing: {
    alignItems: "center",
    flexDirection: "row",
  },
});
