import { color } from "@riichimi/ui";
import { StyleSheet, View } from "react-native";
import { Outlet } from "react-router-dom";

import { AppNavigationBar } from "../src/components/app-navigation-bar";
import { WebMcpBridge } from "../src/features/webmcp/webmcp-bridge";
import { AnnouncerProvider } from "../src/state/announcer-context";
import { LocaleProvider } from "../src/state/locale-context";
import { RulesProvider } from "../src/state/rules-context";
import { ScoreHistoryProvider } from "../src/state/score-history-context";
import { SessionProvider } from "../src/state/session-context";
import { TileLabelProvider } from "../src/state/tile-display-context";

// Web root shell: the provider stack, the persistent navigation bar, and the
// routed screen. It replaces the Expo Router `_layout` (fonts and the status bar
// are handled in the web entry) and renders the react-router `Outlet`.
export function RootLayout() {
  return (
    <LocaleProvider>
      <TileLabelProvider>
        <AnnouncerProvider>
          <RulesProvider>
            <ScoreHistoryProvider>
              <SessionProvider>
                <WebMcpBridge />
                <View style={styles.root}>
                  <View style={styles.bar}>
                    <AppNavigationBar />
                  </View>
                  <View style={styles.body}>
                    <Outlet />
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
  bar: { backgroundColor: color.paper },
  body: { flex: 1 },
  root: { flex: 1 },
});
