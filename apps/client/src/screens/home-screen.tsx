import { CalculatorLanding } from "@riichimi/ui";

import { router } from "../navigation/router";

import { useLocale } from "../state/locale-context";
import { useSession } from "../state/session-context";
import { useScoreHistory } from "../state/score-history-context";
import styles from "./home-screen.module.css";

export function HomeScreen() {
  const session = useSession();
  const history = useScoreHistory();
  const { messages } = useLocale();
  return (
    <div className={styles["screen"]}>
      <div className={styles["scroll"]}>
        <div className={styles["content"]}>
          <CalculatorLanding
            copy={messages.home}
            hasActiveSession={session.state !== null}
            historyCount={history.entries.length}
            onHistory={() => {
              router.push("/history");
            }}
            onManual={() => {
              router.push("/manual");
            }}
            onScan={() => {
              router.push("/scan");
            }}
            onSession={() => {
              router.push("/session");
            }}
          />
        </div>
      </div>
    </div>
  );
}
