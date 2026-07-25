import { AnnounceControl } from "../features/announcer/announce-control";
import { LanguageControl } from "../features/i18n/language-control";
import { RulesProfileControl } from "../features/rules/rules-profile-control";
import { TileLabelControl } from "../features/rules/tile-label-control";
import { useSession } from "../state/session-context";
import { useLocale } from "../state/locale-context";
import styles from "./settings-screen.module.css";

/**
 * Setup lives here rather than on the play surfaces. Rules and language are
 * chosen once and then left alone, so keeping them beside the tile picker only
 * costs scrolling during a hand.
 */
export function SettingsScreen() {
  const { t } = useLocale();
  const session = useSession();

  return (
    <div className={styles["screen"]}>
      <div className={styles["scroll"]}>
        <div className={styles["content"]}>
          <h1 className={styles["title"]}>{t("Setup")}</h1>
          <div className={styles["cards"]}>
            <RulesProfileControl lockedProfileId={session.state?.table.rulesProfileId} />
            <TileLabelControl />
            <AnnounceControl />
            <LanguageControl />
          </div>
        </div>
      </div>
    </div>
  );
}
