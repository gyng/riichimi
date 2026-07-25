import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { translate } from "../i18n/catalog";
import type { TranslationValues } from "../i18n/catalog";
import { messages } from "../i18n/messages";
import type { Locale, Messages } from "../i18n/messages";
import {
  loadLocalePreference,
  saveLocalePreference,
} from "../infrastructure/locale-preference-storage";

interface LocaleContextValue {
  readonly locale: Locale;
  readonly messages: Messages;
  readonly selectLocale: (locale: Locale) => void;
  /**
   * Translate an English source string for the active locale. A source with
   * `{placeholder}` slots takes the values to fill them, so a name composed at
   * runtime can still be a single translatable sentence.
   */
  readonly t: (source: string, values?: TranslationValues) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  messages: messages.en,
  selectLocale: () => {},
  // Outside a provider the source string *is* the English, but it still has to be
  // filled in — an unrendered `{tile}` would reach the interface.
  t: (source, values) => translate("en", source, values),
});

export function LocaleProvider({ children }: { readonly children: ReactNode }) {
  const changedDuringLoad = useRef(false);
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    let active = true;
    void loadLocalePreference()
      .then((stored) => {
        if (active && !changedDuringLoad.current) {
          setLocale(stored);
        }
      })
      .catch(() => {
        // An unreadable preference simply leaves the interface in English.
      });
    return () => {
      active = false;
    };
  }, []);

  function selectLocale(next: Locale) {
    changedDuringLoad.current = true;
    setLocale(next);
    void saveLocalePreference(next).catch(() => {
      // Losing the choice is not worth interrupting the task in progress.
    });
  }

  return (
    <LocaleContext.Provider
      value={{
        locale,
        messages: messages[locale],
        selectLocale,
        t: (source, values) => translate(locale, source, values),
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
