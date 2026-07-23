const enabledValue = "on";

export function parseAnnouncerPreference(value: string | null): boolean {
  return value === enabledValue;
}

export function serializeAnnouncerPreference(enabled: boolean): string {
  return enabled ? enabledValue : "off";
}
