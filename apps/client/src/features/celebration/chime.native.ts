import type { ChimePort } from "./chime-port";

/**
 * Native has no Web Audio and no bundled sample yet, so the reveal is silent
 * here. A bundled bell (expo-audio) or a haptic tap (expo-haptics) can implement
 * the port later without touching the celebration.
 */
export const chime: ChimePort = {
  available: false,
  strike(): void {
    // Intentionally silent; `available` tells callers not to rely on it.
  },
};
