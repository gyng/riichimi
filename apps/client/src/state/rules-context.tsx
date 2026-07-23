import { scoringRulesProfile, tenhouRules } from "@riichimi/rules";
import type { RulesPreference } from "../features/rules/rules-preference";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  loadRulesPreference,
  saveRulesPreference,
} from "../infrastructure/rules-preference-storage";
import { loadHouseRules, saveHouseRules } from "../infrastructure/house-rules-storage";
import {
  defaultHouseRules,
  houseRulesProfileId,
  houseScoringRules,
} from "../features/rules/house-rules";
import type { HouseRules } from "../features/rules/house-rules";

interface RulesContextValue {
  readonly activeRules: ReturnType<typeof scoringRulesProfile>;
  readonly houseRules: HouseRules;
  readonly loading: boolean;
  readonly saveHouseRules: (rules: HouseRules) => void;
  readonly selectProfile: (profileId: RulesProfileSelection) => void;
  readonly storageError: string | null;
}

/** A table may follow a published ruleset or its own house rules. */
export type RulesProfileSelection = RulesPreference;

const RulesContext = createContext<RulesContextValue>({
  activeRules: tenhouRules,
  houseRules: defaultHouseRules,
  loading: false,
  saveHouseRules: () => {},
  selectProfile: () => {},
  storageError: null,
});

export function RulesProvider({ children }: { readonly children: ReactNode }) {
  const changedDuringLoad = useRef(false);
  const [profileId, setProfileId] = useState<RulesProfileSelection>(tenhouRules.id);
  const [houseRules, setHouseRules] = useState<HouseRules>(defaultHouseRules);
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

  useEffect(() => {
    let active = true;
    void loadHouseRules()
      .then((stored) => {
        if (active) {
          setHouseRules(stored);
        }
      })
      .catch(() => {
        // Unreadable house rules simply leave the defaults in place.
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<RulesContextValue>(
    () => ({
      activeRules:
        profileId === houseRulesProfileId
          ? houseScoringRules(houseRules)
          : scoringRulesProfile(profileId),
      houseRules,
      saveHouseRules: (nextRules) => {
        setHouseRules(nextRules);
        void saveHouseRules(nextRules).catch(() => {
          setStorageError("These house rules are active now but could not be saved.");
        });
      },
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
    [houseRules, loading, profileId, storageError],
  );

  return <RulesContext.Provider value={value}>{children}</RulesContext.Provider>;
}

export function useRules(): RulesContextValue {
  return useContext(RulesContext);
}
