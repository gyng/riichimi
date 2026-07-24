import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  loadAnnouncerPreference,
  saveAnnouncerPreference,
} from "../infrastructure/announcer-preference-storage";

interface AnnouncerPreference {
  readonly announceWins: boolean;
  readonly setAnnounceWins: (enabled: boolean) => void;
}

const AnnouncerContext = createContext<AnnouncerPreference>({
  announceWins: false,
  setAnnounceWins: () => {},
});

/**
 * Whether a scored win is read aloud, remembered per device and shared so Setup
 * can toggle it and the calculator can read it. Audio that starts on its own is
 * a surprise, so the stored default is off and a change is saved immediately.
 */
export function AnnouncerProvider({ children }: { readonly children: ReactNode }) {
  const changedDuringLoad = useRef(false);
  const [announceWins, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    void loadAnnouncerPreference()
      .then((stored) => {
        if (active && !changedDuringLoad.current) {
          setEnabled(stored);
        }
      })
      .catch(() => {
        // A device that cannot read the preference simply stays silent.
      });
    return () => {
      active = false;
    };
  }, []);

  function setAnnounceWins(next: boolean) {
    changedDuringLoad.current = true;
    setEnabled(next);
    void saveAnnouncerPreference(next).catch(() => {
      // Losing the preference is not worth interrupting scoring.
    });
  }

  return (
    <AnnouncerContext.Provider value={{ announceWins, setAnnounceWins }}>
      {children}
    </AnnouncerContext.Provider>
  );
}

export function useAnnouncer(): AnnouncerPreference {
  return useContext(AnnouncerContext);
}
