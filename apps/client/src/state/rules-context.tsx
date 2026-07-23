import { scoringRulesProfile, wrc2025Rules } from "@riichimi/rules";
import type { ScoringRulesProfileId } from "@riichimi/rules";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  loadRulesPreference,
  saveRulesPreference,
} from "../infrastructure/rules-preference-storage";

interface RulesContextValue {
  readonly activeRules: ReturnType<typeof scoringRulesProfile>;
  readonly loading: boolean;
  readonly selectProfile: (profileId: ScoringRulesProfileId) => void;
  readonly storageError: string | null;
}

const RulesContext = createContext<RulesContextValue>({
  activeRules: wrc2025Rules,
  loading: false,
  selectProfile: () => {},
  storageError: null,
});

export function RulesProvider({ children }: { readonly children: ReactNode }) {
  const changedDuringLoad = useRef(false);
  const [profileId, setProfileId] = useState<ScoringRulesProfileId>(wrc2025Rules.id);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadRulesPreference()
      .then((stored) => {
        if (active && !changedDuringLoad.current) {
          setProfileId(stored);
        }
      })
      .catch(() => {
        if (active) {
          setStorageError("The saved rules preference could not be opened on this device.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<RulesContextValue>(
    () => ({
      activeRules: scoringRulesProfile(profileId),
      loading,
      selectProfile: (nextProfileId) => {
        changedDuringLoad.current = true;
        setProfileId(nextProfileId);
        setStorageError(null);
        void saveRulesPreference(nextProfileId).catch(() => {
          setStorageError("This rules choice is active now but could not be saved.");
        });
      },
      storageError,
    }),
    [loading, profileId, storageError],
  );

  return <RulesContext.Provider value={value}>{children}</RulesContext.Provider>;
}

export function useRules(): RulesContextValue {
  return useContext(RulesContext);
}
