import Storage from "expo-sqlite/kv-store";

import { isLocale } from "../i18n/messages";
import type { Locale } from "../i18n/messages";

const storageKey = "riichimi.locale.v1";

export async function loadLocalePreference(): Promise<Locale> {
  const stored = await Storage.getItem(storageKey);
  // See the web adapter: device-language detection waits until the whole
  // interface is translated, so only an explicit choice switches language.
  return stored !== null && isLocale(stored) ? stored : "en";
}

export async function saveLocalePreference(locale: Locale): Promise<void> {
  await Storage.setItem(storageKey, locale);
}
