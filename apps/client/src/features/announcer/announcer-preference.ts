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
