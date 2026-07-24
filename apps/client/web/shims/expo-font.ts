// Web shim for expo-font. Brush faces are registered in the web entry via the
// FontFace API against Vite's hashed asset URLs, so component-level loading is a
// no-op that always reports "ready" and never blocks the UI.
export function useFonts(_map: Record<string, unknown>): readonly [boolean, Error | null] {
  return [true, null];
}

export async function loadAsync(_map: Record<string, unknown>): Promise<void> {}

export function isLoaded(_family: string): boolean {
  return true;
}
