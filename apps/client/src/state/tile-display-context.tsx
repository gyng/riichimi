import { TileDisplayProvider } from "@riichimi/ui";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  loadTileLabelPreference,
  saveTileLabelPreference,
} from "../infrastructure/tile-display-storage";
import { useLocale } from "./locale-context";

interface TileLabelPreference {
  readonly setShowRankLabels: (enabled: boolean) => void;
  readonly showRankLabels: boolean;
}

const TileLabelContext = createContext<TileLabelPreference>({
  setShowRankLabels: () => {},
  showRankLabels: false,
});

export function TileLabelProvider({ children }: { readonly children: ReactNode }) {
  const { messages } = useLocale();
  const changedDuringLoad = useRef(false);
  const [showRankLabels, setShow] = useState(false);

  useEffect(() => {
    let active = true;
    void loadTileLabelPreference()
      .then((stored) => {
        if (active && !changedDuringLoad.current) {
          setShow(stored);
        }
      })
      .catch(() => {
        // An unreadable preference just leaves the art unlabelled.
      });
    return () => {
      active = false;
    };
  }, []);

  function setShowRankLabels(enabled: boolean) {
    changedDuringLoad.current = true;
    setShow(enabled);
    void saveTileLabelPreference(enabled).catch(() => {
      // Losing the preference is not worth interrupting a hand.
    });
  }

  return (
    <TileLabelContext.Provider value={{ setShowRankLabels, showRankLabels }}>
      <TileDisplayProvider showRankLabels={showRankLabels} tileWords={messages.tiles}>
        {children}
      </TileDisplayProvider>
    </TileLabelContext.Provider>
  );
}

export function useTileLabels(): TileLabelPreference {
  return useContext(TileLabelContext);
}
