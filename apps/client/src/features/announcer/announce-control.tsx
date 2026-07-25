import { classNames } from "@riichimi/ui";

import { speech } from "../../infrastructure/speech";
import { useAnnouncer } from "../../state/announcer-context";
import { useLocale } from "../../state/locale-context";
import styles from "./announce-control.module.css";

/** Setup controls for the win celebration and the spoken announcement. */
export function AnnounceControl() {
  const { t } = useLocale();
  const { announceWins, setAnnounceWins, celebrateWins, setCelebrateWins } = useAnnouncer();

  return (
    <div className={styles["card"]}>
      <p className={styles["kicker"]}>{t("WINS · THIS DEVICE")}</p>

      <button
        aria-checked={celebrateWins}
        className={styles["row"]}
        onClick={() => setCelebrateWins(!celebrateWins)}
        role="checkbox"
        type="button"
      >
        <span
          aria-hidden
          className={classNames(styles["check"], celebrateWins && styles["checkOn"])}
        />
        <span className={styles["label"]}>{t("Celebrate big hands")}</span>
      </button>
      <p className={styles["note"]}>
        {t("Fire, lightning, and a brush stamp on a mangan or better.")}
      </p>

      {speech.available ? (
        <>
          <button
            aria-checked={announceWins}
            className={styles["row"]}
            onClick={() => {
              const next = !announceWins;
              setAnnounceWins(next);
              if (!next) {
                speech.cancel();
              }
            }}
            role="checkbox"
            type="button"
          >
            <span
              aria-hidden
              className={classNames(styles["check"], announceWins && styles["checkOn"])}
            />
            <span className={styles["label"]}>{t("Announce a win out loud")}</span>
          </button>
          <p className={styles["note"]}>{t("Reads the han, fu, and points when a hand scores.")}</p>
        </>
      ) : null}
    </div>
  );
}
