const enabledValue = "on";

/**
 * Which engine speaks. The browser's own voice is the default because it is
 * already on the device; the neural voice sounds the same everywhere but has to
 * be fetched once.
 */
export type AnnouncerVoice = "system" | "neural";

export function parseAnnouncerVoice(value: string | null): AnnouncerVoice {
  return value === "neural" ? "neural" : "system";
}

export function serializeAnnouncerVoice(voice: AnnouncerVoice): string {
  return voice;
}

/**
 * Which of Kokoro's Japanese speakers reads a win. The model publishes five;
 * these are the four that suit a called hand, named for what they sound like
 * rather than by their file names.
 */
export const NEURAL_SPEAKERS = [
  { id: "jf_alpha", label: "Clear" },
  { id: "jf_nezumi", label: "Bright" },
  { id: "jf_tebukuro", label: "Warm" },
  { id: "jm_kumo", label: "Low" },
] as const;

export type NeuralSpeaker = (typeof NEURAL_SPEAKERS)[number]["id"];

export function parseNeuralSpeaker(value: string | null): NeuralSpeaker {
  const found = NEURAL_SPEAKERS.find((speaker) => speaker.id === value);
  return found?.id ?? "jf_alpha";
}

/**
 * How the announcement is delivered. `pace` multiplies the speaking rate and
 * `pauseMs` is the silence held between beats — between one yaku and the next,
 * and before the score lands. Calm reads like a scoreboard; theatrical reads
 * like the parlour.
 */
export const DELIVERIES = [
  { id: "calm", label: "Calm", pace: 1, pauseMs: 90 },
  { id: "parlour", label: "Parlour", pace: 1.1, pauseMs: 260 },
  { id: "theatrical", label: "Theatrical", pace: 1.18, pauseMs: 520 },
] as const;

export type DeliveryId = (typeof DELIVERIES)[number]["id"];
export type Delivery = (typeof DELIVERIES)[number];

export function parseDelivery(value: string | null): DeliveryId {
  const found = DELIVERIES.find((delivery) => delivery.id === value);
  return found?.id ?? "parlour";
}

export function deliveryFor(id: DeliveryId): Delivery {
  return DELIVERIES.find((delivery) => delivery.id === id) ?? DELIVERIES[1];
}

export function parseAnnouncerPreference(value: string | null): boolean {
  return value === enabledValue;
}

// Celebrations are visual and expected, so they stay on until turned off.
export function parseCelebratePreference(value: string | null): boolean {
  return value !== "off";
}

export function serializeAnnouncerPreference(enabled: boolean): string {
  return enabled ? enabledValue : "off";
}
