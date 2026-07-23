import { TopAppBar } from "@richii/ui";
import type { TopAppBarItem } from "@richii/ui";
import { router, usePathname } from "expo-router";

const destinations = [
  { label: "Scan", route: "/scan" },
  { label: "Manual", route: "/manual" },
  { label: "Table", route: "/session" },
  { label: "History", route: "/history" },
] as const;

/**
 * The app's persistent top navigation. Maps the current route to the active
 * destination and drives navigation; the presentational bar lives in `@richii/ui`.
 */
export function AppNavigationBar() {
  const pathname = usePathname();
  const items: readonly TopAppBarItem[] = destinations.map((destination) => ({
    active: pathname === destination.route,
    key: destination.route,
    label: destination.label,
    onPress: () => {
      router.navigate(destination.route);
    },
  }));

  return (
    <TopAppBar
      brandGlyph="立"
      brandLabel="RICHII"
      items={items}
      onBrandPress={() => {
        router.navigate("/");
      }}
    />
  );
}
