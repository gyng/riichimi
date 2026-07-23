import { TopAppBar, TopAppBarAction } from "@riichimi/ui";
import type { TopAppBarItem } from "@riichimi/ui";
import { router, usePathname } from "expo-router";

import { useLocale } from "../state/locale-context";
import type { Messages } from "../i18n/messages";

const destinations = [
  { key: "scan", route: "/scan" },
  { key: "manual", route: "/manual" },
  { key: "table", route: "/session" },
  { key: "history", route: "/history" },
] as const satisfies readonly { key: keyof Messages["nav"]; route: string }[];

/**
 * The app's persistent top navigation. Maps the current route to the active
 * destination and drives navigation; the presentational bar lives in `@riichimi/ui`.
 */
export function AppNavigationBar() {
  const pathname = usePathname();
  const { messages } = useLocale();
  const items: readonly TopAppBarItem[] = destinations.map((destination) => ({
    active: pathname === destination.route,
    key: destination.route,
    label: messages.nav[destination.key],
    onPress: () => {
      router.navigate(destination.route);
    },
  }));

  return (
    <TopAppBar
      brandGlyph="立"
      brandLabel="RIICHIMI"
      items={items}
      onBrandPress={() => {
        router.navigate("/");
      }}
      trailing={
        <TopAppBarAction
          active={pathname === "/settings"}
          label={messages.nav.setup}
          onPress={() => {
            router.navigate("/settings");
          }}
        />
      }
    />
  );
}
