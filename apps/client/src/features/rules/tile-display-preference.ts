const enabledValue = "on";

export function parseTileLabelPreference(value: string | null): boolean {
  return value === enabledValue;
}

export function serializeTileLabelPreference(enabled: boolean): string {
  return enabled ? enabledValue : "off";
}
