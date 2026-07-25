import { Checkbox } from "@riichimi/ui";

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

      <Checkbox
        checked={celebrateWins}
        label={t("Celebrate big hands")}
        onChange={setCelebrateWins}
      />
      <p className={styles["note"]}>
        {t("Fire, lightning, and a brush stamp on a mangan or better.")}
      </p>

      {speech.available ? (
        <>
          <Checkbox
            checked={announceWins}
            label={t("Announce a win out loud")}
            onChange={(next) => {
              setAnnounceWins(next);
              if (!next) {
                // Stop mid-sentence rather than finishing what nobody asked for.
                speech.cancel();
              }
            }}
          />
          <p className={styles["note"]}>{t("Reads the han, fu, and points when a hand scores.")}</p>
        </>
      ) : null}
    </div>
  );
}
