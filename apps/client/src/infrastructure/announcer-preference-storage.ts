import type {
  AnnouncerVoice,
  DeliveryId,
  NeuralSpeaker,
} from "../features/announcer/announcer-preference";
import {
  parseAnnouncerPreference,
  parseAnnouncerVoice,
  parseCelebratePreference,
  parseDelivery,
  parseNeuralSpeaker,
  serializeAnnouncerPreference,
  serializeAnnouncerVoice,
} from "../features/announcer/announcer-preference";

const storageKey = "riichimi.announce-wins.v1";
const celebrateKey = "riichimi.celebrate-wins.v1";
const voiceKey = "riichimi.announce-voice.v1";
const speakerKey = "riichimi.announce-speaker.v1";
const deliveryKey = "riichimi.announce-delivery.v1";

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

export async function loadNeuralSpeaker(): Promise<NeuralSpeaker> {
  return parseNeuralSpeaker(globalThis.localStorage?.getItem(speakerKey) ?? null);
}

export async function saveNeuralSpeaker(speaker: NeuralSpeaker): Promise<void> {
  globalThis.localStorage?.setItem(speakerKey, speaker);
}

export async function loadDelivery(): Promise<DeliveryId> {
  return parseDelivery(globalThis.localStorage?.getItem(deliveryKey) ?? null);
}

export async function saveDelivery(delivery: DeliveryId): Promise<void> {
  globalThis.localStorage?.setItem(deliveryKey, delivery);
}
