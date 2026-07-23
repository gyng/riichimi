import {
  applyDraw,
  applyWin,
  createSession,
  declareRiichi,
  undoLastSessionChange,
} from "@richii/session-core";
import type { DrawCommand, SessionState, WinCommand } from "@richii/session-core";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { loadStoredSession, saveStoredSession } from "../infrastructure/session-storage";
import { useRules } from "./rules-context";

interface SessionContextValue {
  readonly clearSession: () => void;
  readonly createTable: (playerNames: readonly string[]) => void;
  readonly declarePlayerRiichi: (playerIndex: number) => void;
  readonly loading: boolean;
  readonly recordDraw: (command: DrawCommand) => void;
  readonly recordWin: (command: WinCommand) => void;
  readonly state: SessionState | null;
  readonly storageError: string | null;
  readonly undo: () => void;
}

const emptyContext: SessionContextValue = {
  clearSession: () => {},
  createTable: () => {},
  declarePlayerRiichi: () => {},
  loading: false,
  recordDraw: () => {},
  recordWin: () => {},
  state: null,
  storageError: null,
  undo: () => {},
};

const SessionContext = createContext<SessionContextValue>(emptyContext);

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function SessionProvider({ children }: { readonly children: ReactNode }) {
  const rules = useRules();
  const [state, setState] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadStoredSession()
      .then((stored) => {
        if (active) {
          setState(stored);
        }
      })
      .catch(() => {
        if (active) {
          setStorageError("Saved table data could not be opened. You can start a new table.");
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

  function commit(next: SessionState | null) {
    setState(next);
    setStorageError(null);
    void saveStoredSession(next).catch(() => {
      setStorageError("This change is visible now but could not be saved on this device.");
    });
  }

  const value = useMemo<SessionContextValue>(
    () => ({
      clearSession: () => commit(null),
      createTable: (playerNames) =>
        commit(
          createSession({
            id: newId("table"),
            playerNames,
            rulesProfileId: rules.activeRules.id,
            startedAt: new Date().toISOString(),
          }),
        ),
      declarePlayerRiichi: (playerIndex) => {
        if (state !== null) {
          commit(declareRiichi(state, playerIndex));
        }
      },
      loading,
      recordDraw: (command) => {
        if (state !== null) {
          commit(applyDraw(state, command));
        }
      },
      recordWin: (command) => {
        if (state !== null) {
          commit(applyWin(state, command));
        }
      },
      state,
      storageError,
      undo: () => {
        if (state !== null) {
          commit(undoLastSessionChange(state));
        }
      },
    }),
    [loading, rules.activeRules.id, state, storageError],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}

export function createRoundCommandMetadata() {
  return { id: newId("round"), occurredAt: new Date().toISOString() };
}
