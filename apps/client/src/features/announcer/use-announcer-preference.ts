import { useEffect, useRef, useState } from "react";

import {
  loadAnnouncerPreference,
  saveAnnouncerPreference,
} from "../../infrastructure/announcer-preference-storage";

/**
 * Announcements are opt-in and remembered per device. Audio that starts on its
 * own is a surprise, so the stored default is off and a change is saved
 * immediately rather than on some later commit.
 */
export function useAnnouncerPreference(): readonly [boolean, (enabled: boolean) => void] {
  const changedDuringLoad = useRef(false);
  const [enabled, setEnabled] = useState(false);

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

  function choose(next: boolean) {
    changedDuringLoad.current = true;
    setEnabled(next);
    void saveAnnouncerPreference(next).catch(() => {
      // Losing the preference is not worth interrupting scoring.
    });
  }

  return [enabled, choose];
}
