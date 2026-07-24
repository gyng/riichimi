import type { ScoreHistoryState } from "../features/score-history/score-history";
import { parseScoreHistory } from "../features/score-history/score-history";

const storageKey = "riichimi.score-history.v1";
// The project was renamed from "richii"; folios written before that are still
// read so the rename cannot silently discard someone's saved scores. The next
// save moves them to the current key.
const renamedStorageKey = "richii.score-history.v1";

export async function loadScoreHistory(): Promise<ScoreHistoryState | null> {
  const stored = globalThis.localStorage;
  const value = stored?.getItem(storageKey) ?? stored?.getItem(renamedStorageKey) ?? null;
  return value === null ? null : parseScoreHistory(value);
}

export async function saveScoreHistory(state: ScoreHistoryState): Promise<void> {
  globalThis.localStorage?.setItem(storageKey, JSON.stringify(state));
}
