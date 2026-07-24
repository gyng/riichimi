import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  loadAnnouncerPreference,
  loadCelebratePreference,
  saveAnnouncerPreference,
  saveCelebratePreference,
} from "../infrastructure/announcer-preference-storage";

interface AnnouncerPreference {
  readonly announceWins: boolean;
  readonly setAnnounceWins: (enabled: boolean) => void;
  readonly celebrateWins: boolean;
  readonly setCelebrateWins: (enabled: boolean) => void;
}

const AnnouncerContext = createContext<AnnouncerPreference>({
  announceWins: false,
  setAnnounceWins: () => {},
  celebrateWins: true,
  setCelebrateWins: () => {},
});

/**
 * Two per-device win-feedback preferences, shared so Setup can toggle them and
 * the calculator can read them. Announcing audio that starts on its own is a
 * surprise, so it defaults off; the visual celebration is expected and defaults
 * on. Both are saved immediately on change.
 */
export function AnnouncerProvider({ children }: { readonly children: ReactNode }) {
  const announceChanged = useRef(false);
  const celebrateChanged = useRef(false);
  const [announceWins, setAnnounce] = useState(false);
  const [celebrateWins, setCelebrate] = useState(true);

  useEffect(() => {
    let active = true;
    void loadAnnouncerPreference()
      .then((stored) => {
        if (active && !announceChanged.current) {
          setAnnounce(stored);
        }
      })
      .catch(() => {
        // A device that cannot read the preference simply stays silent.
      });
    void loadCelebratePreference()
      .then((stored) => {
        if (active && !celebrateChanged.current) {
          setCelebrate(stored);
        }
      })
      .catch(() => {
        // A device that cannot read the preference keeps the default.
      });
    return () => {
      active = false;
    };
  }, []);

  function setAnnounceWins(next: boolean) {
    announceChanged.current = true;
    setAnnounce(next);
    void saveAnnouncerPreference(next).catch(() => {
      // Losing the preference is not worth interrupting scoring.
    });
  }

  function setCelebrateWins(next: boolean) {
    celebrateChanged.current = true;
    setCelebrate(next);
    void saveCelebratePreference(next).catch(() => {
      // Losing the preference is not worth interrupting scoring.
    });
  }

  return (
    <AnnouncerContext.Provider
      value={{ announceWins, setAnnounceWins, celebrateWins, setCelebrateWins }}
    >
      {children}
    </AnnouncerContext.Provider>
  );
}

export function useAnnouncer(): AnnouncerPreference {
  return useContext(AnnouncerContext);
}
