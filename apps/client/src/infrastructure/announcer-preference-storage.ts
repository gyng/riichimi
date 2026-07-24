import {
  parseAnnouncerPreference,
  parseCelebratePreference,
  serializeAnnouncerPreference,
} from "../features/announcer/announcer-preference";

const storageKey = "riichimi.announce-wins.v1";
const celebrateKey = "riichimi.celebrate-wins.v1";

export async function loadAnnouncerPreference(): Promise<boolean> {
  return parseAnnouncerPreference(globalThis.localStorage?.getItem(storageKey) ?? null);
}

export async function saveAnnouncerPreference(enabled: boolean): Promise<void> {
  globalThis.localStorage?.setItem(storageKey, serializeAnnouncerPreference(enabled));
}

export async function loadCelebratePreference(): Promise<boolean> {
  return parseCelebratePreference(globalThis.localStorage?.getItem(celebrateKey) ?? null);
}

export async function saveCelebratePreference(enabled: boolean): Promise<void> {
  globalThis.localStorage?.setItem(celebrateKey, serializeAnnouncerPreference(enabled));
}
