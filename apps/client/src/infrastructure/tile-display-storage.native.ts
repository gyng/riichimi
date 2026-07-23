import Storage from "expo-sqlite/kv-store";

import {
  parseTileLabelPreference,
  serializeTileLabelPreference,
} from "../features/rules/tile-display-preference";

const storageKey = "riichimi.tile-labels.v1";

export async function loadTileLabelPreference(): Promise<boolean> {
  return parseTileLabelPreference(await Storage.getItem(storageKey));
}

export async function saveTileLabelPreference(enabled: boolean): Promise<void> {
  await Storage.setItem(storageKey, serializeTileLabelPreference(enabled));
}
