import { classNames } from "@riichimi/ui";

import { useLocale } from "../../state/locale-context";
import { useTileLabels } from "../../state/tile-display-context";
import styles from "./tile-label-control.module.css";

export function TileLabelControl() {
  const { t } = useLocale();
  const { setShowRankLabels, showRankLabels } = useTileLabels();

  return (
    <div className={styles["card"]}>
      <p className={styles["kicker"]}>{t("TILES · THIS DEVICE")}</p>
      <button
        aria-checked={showRankLabels}
        className={styles["row"]}
        onClick={() => setShowRankLabels(!showRankLabels)}
        role="checkbox"
        type="button"
      >
        <span
          aria-hidden
          className={classNames(styles["check"], showRankLabels && styles["checkOn"])}
        />
        <span className={styles["label"]}>{t("Show the rank in the tile corner")}</span>
      </button>
      <p className={styles["note"]}>{t("Adds 5p / 3s to each face.")}</p>
    </div>
  );
}
