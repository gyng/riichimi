import Storage from "expo-sqlite/kv-store";

import {
  parseAnnouncerPreference,
  serializeAnnouncerPreference,
} from "../features/announcer/announcer-preference";

const storageKey = "richii.announce-wins.v1";

export async function loadAnnouncerPreference(): Promise<boolean> {
  return parseAnnouncerPreference(await Storage.getItem(storageKey));
}

export async function saveAnnouncerPreference(enabled: boolean): Promise<void> {
  await Storage.setItem(storageKey, serializeAnnouncerPreference(enabled));
}
