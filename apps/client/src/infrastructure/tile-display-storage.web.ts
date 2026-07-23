import {
  parseTileLabelPreference,
  serializeTileLabelPreference,
} from "../features/rules/tile-display-preference";

const storageKey = "riichimi.tile-labels.v1";

export async function loadTileLabelPreference(): Promise<boolean> {
  return parseTileLabelPreference(globalThis.localStorage?.getItem(storageKey) ?? null);
}

export async function saveTileLabelPreference(enabled: boolean): Promise<void> {
  globalThis.localStorage?.setItem(storageKey, serializeTileLabelPreference(enabled));
}
