import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

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
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  messages: messages.en,
  selectLocale: () => {},
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
    <LocaleContext.Provider value={{ locale, messages: messages[locale], selectLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
