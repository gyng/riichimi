import type { ScoreHandInput, ScoreSuccess } from "@riichimi/score-core";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  addScoreHistoryEntry,
  createScoreHistoryEntry,
  emptyScoreHistory,
  removeScoreHistoryEntry,
} from "../features/score-history/score-history";
import type { ScoreHistoryEntry, ScoreHistoryState } from "../features/score-history/score-history";
import { loadScoreHistory, saveScoreHistory } from "../infrastructure/score-history-storage";

interface ScoreHistoryContextValue {
  readonly clear: () => void;
  readonly entries: readonly ScoreHistoryEntry[];
  readonly loading: boolean;
  readonly record: (hand: ScoreHandInput, result: ScoreSuccess) => void;
  readonly remove: (entryId: string) => void;
  readonly storageError: string | null;
}

const emptyContext: ScoreHistoryContextValue = {
  clear: () => {},
  entries: [],
  loading: false,
  record: () => {},
  remove: () => {},
  storageError: null,
};

const ScoreHistoryContext = createContext<ScoreHistoryContextValue>(emptyContext);

function scoreId(): string {
  return `score-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ScoreHistoryProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<ScoreHistoryState>(emptyScoreHistory);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadScoreHistory()
      .then((stored) => {
        if (active && stored !== null) {
          setState(stored);
        }
      })
      .catch(() => {
        if (active) {
          setStorageError("Recent scores could not be opened on this device.");
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

  function commit(next: ScoreHistoryState) {
    setState(next);
    setStorageError(null);
    void saveScoreHistory(next).catch(() => {
      setStorageError("This score is visible now but could not be saved on this device.");
    });
  }

  const value = useMemo<ScoreHistoryContextValue>(
    () => ({
      clear: () => commit(emptyScoreHistory),
      entries: state.entries,
      loading,
      record: (hand, result) =>
        commit(
          addScoreHistoryEntry(
            state,
            createScoreHistoryEntry({
              calculatedAt: new Date().toISOString(),
              hand,
              id: scoreId(),
              result,
            }),
          ),
        ),
      remove: (entryId) => commit(removeScoreHistoryEntry(state, entryId)),
      storageError,
    }),
    [loading, state, storageError],
  );

  return <ScoreHistoryContext.Provider value={value}>{children}</ScoreHistoryContext.Provider>;
}

export function useScoreHistory(): ScoreHistoryContextValue {
  return useContext(ScoreHistoryContext);
}
