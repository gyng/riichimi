import type { AnnouncerVoice } from "../features/announcer/announcer-preference";
import {
  parseAnnouncerPreference,
  parseAnnouncerVoice,
  parseCelebratePreference,
  serializeAnnouncerPreference,
  serializeAnnouncerVoice,
} from "../features/announcer/announcer-preference";

const storageKey = "riichimi.announce-wins.v1";
const celebrateKey = "riichimi.celebrate-wins.v1";
const voiceKey = "riichimi.announce-voice.v1";

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

export async function loadAnnouncerVoice(): Promise<AnnouncerVoice> {
  return parseAnnouncerVoice(globalThis.localStorage?.getItem(voiceKey) ?? null);
}

export async function saveAnnouncerVoice(voice: AnnouncerVoice): Promise<void> {
  globalThis.localStorage?.setItem(voiceKey, serializeAnnouncerVoice(voice));
}
