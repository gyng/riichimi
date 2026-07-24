import type { ReactNode } from "react";
import { View } from "react-native";
import type { ViewProps } from "react-native";

// Web shim for react-native-safe-area-context. Browsers have no unsafe device
// insets to avoid, so SafeAreaView is a passthrough View and every inset is zero.
export function SafeAreaView({
  edges: _edges,
  ...props
}: ViewProps & { readonly edges?: readonly string[] }) {
  return <View {...props} />;
}

export function SafeAreaProvider({ children }: { readonly children: ReactNode }) {
  return <>{children}</>;
}

export function useSafeAreaInsets() {
  return { bottom: 0, left: 0, right: 0, top: 0 } as const;
}

export const initialWindowMetrics = {
  frame: { height: 0, width: 0, x: 0, y: 0 },
  insets: { bottom: 0, left: 0, right: 0, top: 0 },
} as const;
