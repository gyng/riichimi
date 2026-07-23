import Storage from "expo-sqlite/kv-store";

import type { ScoreHistoryState } from "../features/score-history/score-history";
import { parseScoreHistory } from "../features/score-history/score-history";

const storageKey = "riichimi.score-history.v1";
// See the web adapter: folios saved under the pre-rename key stay readable.
const renamedStorageKey = "richii.score-history.v1";

export async function loadScoreHistory(): Promise<ScoreHistoryState | null> {
  const value = (await Storage.getItem(storageKey)) ?? (await Storage.getItem(renamedStorageKey));
  return value === null ? null : parseScoreHistory(value);
}

export async function saveScoreHistory(state: ScoreHistoryState): Promise<void> {
  await Storage.setItem(storageKey, JSON.stringify(state));
}
