import { TopAppBar, TopAppBarAction, TopAppBarSelect } from "@riichimi/ui";
import type { TopAppBarChoice, TopAppBarItem } from "@riichimi/ui";
import { router, usePathname } from "../navigation/router";

import { isLocale, supportedLocales, messages as translations } from "../i18n/messages";
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
const languages: readonly TopAppBarChoice[] = supportedLocales.map((locale) => ({
  label: translations[locale].localeName,
  value: locale,
}));

export function AppNavigationBar() {
  const pathname = usePathname();
  const { locale, messages, selectLocale, t } = useLocale();
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
      brandLabel={messages.brandName}
      homeLabel={t("{brand} home", { brand: messages.brandName })}
      items={items}
      navLabel={messages.nav.primary}
      onBrandPress={() => {
        router.navigate("/");
      }}
      trailing={
        <>
          <TopAppBarSelect
            label={messages.language.label}
            onChange={(next) => {
              // The select's value is a string as far as the DOM knows.
              if (isLocale(next)) {
                selectLocale(next);
              }
            }}
            options={languages}
            value={locale}
          />
          <TopAppBarAction
            active={pathname === "/settings"}
            label={messages.nav.setup}
            onPress={() => {
              router.navigate("/settings");
            }}
          />
        </>
      }
    />
  );
}
