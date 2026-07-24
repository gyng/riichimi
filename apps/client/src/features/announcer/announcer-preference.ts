const enabledValue = "on";

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
