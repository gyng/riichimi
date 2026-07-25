import { classNames } from "@riichimi/ui";
import type { NormalizedBounds } from "@riichimi/vision";

import styles from "./tile-bounds-overlay.module.css";

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
    <div aria-label="Recognized tiles on the photo" className={styles["layer"]}>
      {boxes.map((box) => {
        const selected = box.id === selectedId;
        return (
          <button
            aria-label={box.label}
            aria-pressed={selected}
            className={classNames(
              styles["box"],
              box.needsReview && styles["boxReview"],
              selected && styles["boxSelected"],
            )}
            key={box.id}
            onClick={() => onSelect(box.id)}
            // Placed from the recognizer's normalized bounds, so these are the
            // one thing here that cannot live in the stylesheet.
            style={{
              height: `${box.bounds.height * 100}%`,
              left: `${box.bounds.x * 100}%`,
              top: `${box.bounds.y * 100}%`,
              width: `${box.bounds.width * 100}%`,
            }}
            type="button"
          >
            <span
              className={classNames(
                styles["badge"],
                box.needsReview && styles["badgeReview"],
                selected && styles["badgeSelected"],
              )}
            >
              {box.needsReview ? `▲${box.badge}` : box.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}
