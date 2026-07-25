import { CalculatorLanding, ScrollView, View, color } from "@riichimi/ui";
import type { Styles } from "@riichimi/ui";
import { router } from "../navigation/router";

import { useLocale } from "../state/locale-context";
import { useSession } from "../state/session-context";
import { useScoreHistory } from "../state/score-history-context";

export function HomeScreen() {
  const session = useSession();
  const history = useScoreHistory();
  const { messages } = useLocale();
  return (
    <View style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
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
      </ScrollView>
    </View>
  );
}

const styles = {
  content: {
    flexGrow: 1,
  },
  safeArea: {
    backgroundColor: color.canvas,
    flex: 1,
  },
} satisfies Styles;
