import { canonicalTileIds, redFiveIds } from "@riichimi/score-core";
import type { TileId } from "@riichimi/score-core";
import { MahjongTile } from "@riichimi/ui";

import { useLocale } from "../../state/locale-context";
import styles from "./tile-picker.module.css";

const rows = [
  { label: "Characters", tiles: canonicalTileIds.slice(0, 9) },
  { label: "Circles", tiles: canonicalTileIds.slice(9, 18) },
  { label: "Bamboo", tiles: canonicalTileIds.slice(18, 27) },
  { label: "Honours", tiles: canonicalTileIds.slice(27) },
] as const;

export interface TilePickerProps {
  readonly isDisabled: (tile: TileId) => boolean;
  readonly onSelect: (tile: TileId) => void;
  readonly showRedFives?: boolean | undefined;
}

export function TilePicker({ isDisabled, onSelect, showRedFives = false }: TilePickerProps) {
  const { t } = useLocale();

  return (
    <div className={styles["root"]}>
      {rows.map((row) => (
        <div className={styles["suit"]} key={row.label}>
          <p className={styles["label"]}>{t(row.label).toUpperCase()}</p>
          <div className={styles["tiles"]}>
            {row.tiles.map((tile) => (
              <div className={styles["slot"]} key={tile}>
                <MahjongTile
                  disabled={isDisabled(tile)}
                  fill
                  onPress={() => onSelect(tile)}
                  tile={tile}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      {showRedFives ? (
        <div className={styles["suit"]}>
          <p className={styles["label"]}>{t("Red fives").toUpperCase()}</p>
          <div className={styles["tiles"]}>
            {redFiveIds.map((tile) => (
              <div className={styles["slot"]} key={tile}>
                <MahjongTile
                  disabled={isDisabled(tile)}
                  fill
                  onPress={() => onSelect(tile)}
                  tile={tile}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
