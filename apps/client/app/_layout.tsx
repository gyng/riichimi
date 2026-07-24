import { color } from "@riichimi/ui";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppNavigationBar } from "../src/components/app-navigation-bar";
import { LocaleProvider } from "../src/state/locale-context";
import { AnnouncerProvider } from "../src/state/announcer-context";
import { TileLabelProvider } from "../src/state/tile-display-context";
import { SessionProvider } from "../src/state/session-context";
import { ScoreHistoryProvider } from "../src/state/score-history-context";
import { RulesProvider } from "../src/state/rules-context";
import { WebMcpBridge } from "../src/features/webmcp/webmcp-bridge";

export default function RootLayout() {
  return (
    <LocaleProvider>
      <TileLabelProvider>
        <AnnouncerProvider>
          <RulesProvider>
            <ScoreHistoryProvider>
              <SessionProvider>
                <WebMcpBridge />
                <StatusBar style="dark" />
                <View style={styles.root}>
                  <SafeAreaView edges={["top"]} style={styles.barSafeArea}>
                    <AppNavigationBar />
                  </SafeAreaView>
                  <View style={styles.body}>
                    <Stack screenOptions={{ headerShown: false }} />
                  </View>
                </View>
              </SessionProvider>
            </ScoreHistoryProvider>
          </RulesProvider>
        </AnnouncerProvider>
      </TileLabelProvider>
    </LocaleProvider>
  );
}

const styles = StyleSheet.create({
  barSafeArea: { backgroundColor: color.paper },
  body: { flex: 1 },
  root: { flex: 1 },
});
