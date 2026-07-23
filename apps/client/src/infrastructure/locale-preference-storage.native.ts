import Storage from "expo-sqlite/kv-store";

import { isLocale, resolveLocale } from "../i18n/messages";
import type { Locale } from "../i18n/messages";

const storageKey = "riichimi.locale.v1";

/** Device language via Intl, which Hermes provides — no extra dependency. */
function deviceLocale(): string | null {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return null;
  }
}

export async function loadLocalePreference(): Promise<Locale> {
  const stored = await Storage.getItem(storageKey);
  // An explicit choice always wins; otherwise follow the device language.
  return stored !== null && isLocale(stored) ? stored : resolveLocale(deviceLocale());
}

export async function saveLocalePreference(locale: Locale): Promise<void> {
  await Storage.setItem(storageKey, locale);
}
