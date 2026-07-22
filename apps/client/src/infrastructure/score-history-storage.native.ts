import Storage from "expo-sqlite/kv-store";

import type { ScoreHistoryState } from "../features/score-history/score-history";
import { parseScoreHistory } from "../features/score-history/score-history";

const storageKey = "richii.score-history.v1";

export async function loadScoreHistory(): Promise<ScoreHistoryState | null> {
  const value = await Storage.getItem(storageKey);
  return value === null ? null : parseScoreHistory(value);
}

export async function saveScoreHistory(state: ScoreHistoryState): Promise<void> {
  await Storage.setItem(storageKey, JSON.stringify(state));
}
