import type { Styles } from "@riichimi/ui";
import type { NormalizedBounds } from "@riichimi/vision";
import { Pressable, Text, View, color } from "@riichimi/ui";

export interface TileBoundsBox {
  readonly id: string;
  readonly bounds: NormalizedBounds;
  /** Full accessible name, e.g. "Hand tile 2". */
  readonly label: string;
  /** Short marker shown on the box, e.g. "2", so it maps to the list below. */
  readonly badge: string;
  readonly needsReview: boolean;
}

export interface TileBoundsOverlayProps {
  readonly boxes: readonly TileBoundsBox[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}

// Draws each recognized tile's box over the photo so the review is anchored to
// where the tile actually is. Bounds are normalized (0–1), so positioning is by
// percentage — correct as long as the photo is shown at its true aspect ratio.
// Tapping a box selects that tile, making the photo and the list two ways into
// the same correction.
export function TileBoundsOverlay({ boxes, selectedId, onSelect }: TileBoundsOverlayProps) {
  return (
    <View aria-label="Recognized tiles on the photo" style={styles.layer}>
      {boxes.map((box) => {
        const selected = box.id === selectedId;
        return (
          <Pressable
            aria-label={box.label}
            aria-pressed={selected}
            key={box.id}
            onPress={() => onSelect(box.id)}
            style={[
              styles.box,
              {
                height: `${box.bounds.height * 100}%`,
                left: `${box.bounds.x * 100}%`,
                top: `${box.bounds.y * 100}%`,
                width: `${box.bounds.width * 100}%`,
              },
              box.needsReview && styles.boxReview,
              selected && styles.boxSelected,
            ]}
          >
            <Text
              style={[
                styles.badge,
                box.needsReview && styles.badgeReview,
                selected && styles.badgeSelected,
              ]}
            >
              {box.needsReview ? `▲${box.badge}` : box.badge}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = {
  badge: {
    backgroundColor: "rgba(23,25,22,0.72)",
    borderTopLeftRadius: 5,
    borderBottomRightRadius: 5,
    color: color.white,
    fontFamily: "monospace",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  badgeReview: { backgroundColor: color.accent },
  badgeSelected: { backgroundColor: color.ink },
  box: {
    alignItems: "flex-start",
    // The layer itself is transparent to presses; each box takes its own back.
    pointerEvents: "auto",
    borderColor: "rgba(255,253,247,0.85)",
    borderRadius: 5,
    borderWidth: 1.5,
    justifyContent: "flex-start",
    position: "absolute",
  },
  boxReview: { borderColor: color.accent, borderWidth: 2 },
  boxSelected: { borderColor: color.white, borderWidth: 3 },
  // Covers the photo without stealing the pinch and drag gestures over it.
  layer: { bottom: 0, left: 0, pointerEvents: "none", position: "absolute", right: 0, top: 0 },
} satisfies Styles;
