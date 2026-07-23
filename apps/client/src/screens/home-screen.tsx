import { CalculatorLanding, color } from "@riichimi/ui";
import { router } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { bodyEdges } from "../components/screen-insets";
import { LanguageControl } from "../features/i18n/language-control";
import { useLocale } from "../state/locale-context";
import { useSession } from "../state/session-context";
import { useScoreHistory } from "../state/score-history-context";
import { RulesProfileControl } from "../features/rules/rules-profile-control";

export function HomeScreen() {
  const session = useSession();
  const history = useScoreHistory();
  const { messages } = useLocale();
  return (
    <SafeAreaView edges={bodyEdges} style={styles.safeArea}>
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
          rulesControl={
            <>
              <RulesProfileControl lockedProfileId={session.state?.table.rulesProfileId} />
              <LanguageControl />
            </>
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  safeArea: {
    backgroundColor: color.canvas,
    flex: 1,
  },
});
