import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { SessionProvider } from "../src/state/session-context";
import { ScoreHistoryProvider } from "../src/state/score-history-context";
import { RulesProvider } from "../src/state/rules-context";
import { WebMcpBridge } from "../src/features/webmcp/webmcp-bridge";

export default function RootLayout() {
  return (
    <RulesProvider>
      <ScoreHistoryProvider>
        <SessionProvider>
          <WebMcpBridge />
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
        </SessionProvider>
      </ScoreHistoryProvider>
    </RulesProvider>
  );
}
