import { isLocale } from "../i18n/messages";
import type { Locale } from "../i18n/messages";

const storageKey = "riichimi.locale.v1";

export async function loadLocalePreference(): Promise<Locale> {
  const stored = globalThis.localStorage?.getItem(storageKey) ?? null;
  // Only an explicit choice switches language. Following the device language is
  // the right end state, but until every surface is translated it would hand a
  // Japanese phone a half-translated interface, so that stays off on purpose.
  return stored !== null && isLocale(stored) ? stored : "en";
}

export async function saveLocalePreference(locale: Locale): Promise<void> {
  globalThis.localStorage?.setItem(storageKey, locale);
}
