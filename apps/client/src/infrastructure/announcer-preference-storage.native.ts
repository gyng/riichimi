import Storage from "expo-sqlite/kv-store";

import {
  parseAnnouncerPreference,
  parseCelebratePreference,
  serializeAnnouncerPreference,
} from "../features/announcer/announcer-preference";

const storageKey = "riichimi.announce-wins.v1";
const celebrateKey = "riichimi.celebrate-wins.v1";

export async function loadAnnouncerPreference(): Promise<boolean> {
  return parseAnnouncerPreference(await Storage.getItem(storageKey));
}

export async function saveAnnouncerPreference(enabled: boolean): Promise<void> {
  await Storage.setItem(storageKey, serializeAnnouncerPreference(enabled));
}

export async function loadCelebratePreference(): Promise<boolean> {
  return parseCelebratePreference(await Storage.getItem(celebrateKey));
}

export async function saveCelebratePreference(enabled: boolean): Promise<void> {
  await Storage.setItem(celebrateKey, serializeAnnouncerPreference(enabled));
}
