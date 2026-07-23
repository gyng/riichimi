import {
  parseAnnouncerPreference,
  serializeAnnouncerPreference,
} from "../features/announcer/announcer-preference";

const storageKey = "riichimi.announce-wins.v1";

export async function loadAnnouncerPreference(): Promise<boolean> {
  return parseAnnouncerPreference(globalThis.localStorage?.getItem(storageKey) ?? null);
}

export async function saveAnnouncerPreference(enabled: boolean): Promise<void> {
  globalThis.localStorage?.setItem(storageKey, serializeAnnouncerPreference(enabled));
}
