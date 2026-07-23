import { color, space } from "@riichimi/ui";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { bodyEdges } from "../components/screen-insets";
import { LanguageControl } from "../features/i18n/language-control";
import { RulesProfileControl } from "../features/rules/rules-profile-control";
import { TileLabelControl } from "../features/rules/tile-label-control";
import { useSession } from "../state/session-context";
import { useLocale } from "../state/locale-context";

/**
 * Setup lives here rather than on the play surfaces. Rules and language are
 * chosen once and then left alone, so keeping them beside the tile picker only
 * costs scrolling during a hand.
 */
export function SettingsScreen() {
  const { t } = useLocale();
  const session = useSession();

  return (
    <SafeAreaView edges={bodyEdges} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {t("Setup")}
        </Text>
        <View style={styles.section}>
          <RulesProfileControl lockedProfileId={session.state?.table.rulesProfileId} />
          <TileLabelControl />
          <LanguageControl />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    alignSelf: "center",
    maxWidth: 900,
    padding: space.x4,
    paddingBottom: space.x7,
    width: "100%",
  },
  safeArea: { backgroundColor: color.canvas, flex: 1 },
  section: { marginTop: space.x4 },
  title: {
    color: color.ink,
    fontFamily: "serif",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
});
