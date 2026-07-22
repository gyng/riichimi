import type { ScoreHistoryState } from "../features/score-history/score-history";
import { parseScoreHistory } from "../features/score-history/score-history";

const storageKey = "richii.score-history.v1";

export async function loadScoreHistory(): Promise<ScoreHistoryState | null> {
  const value = globalThis.localStorage?.getItem(storageKey) ?? null;
  return value === null ? null : parseScoreHistory(value);
}

export async function saveScoreHistory(state: ScoreHistoryState): Promise<void> {
  globalThis.localStorage?.setItem(storageKey, JSON.stringify(state));
}
