import { isLocale, resolveLocale } from "../i18n/messages";
import type { Locale } from "../i18n/messages";

const storageKey = "riichimi.locale.v1";

export async function loadLocalePreference(): Promise<Locale> {
  const stored = globalThis.localStorage?.getItem(storageKey) ?? null;
  // An explicit choice always wins; otherwise follow the browser, now that the
  // interface is translated rather than half-translated.
  return stored !== null && isLocale(stored)
    ? stored
    : resolveLocale(globalThis.navigator?.language ?? null);
}

export async function saveLocalePreference(locale: Locale): Promise<void> {
  globalThis.localStorage?.setItem(storageKey, locale);
}
