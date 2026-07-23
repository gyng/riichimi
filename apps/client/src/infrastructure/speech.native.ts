import type { SpeechPort } from "../features/announcer/speech-port";

/**
 * Native has no voice yet. Rather than pull in a speech dependency before the
 * feature has earned it, the port reports itself unavailable and the UI hides
 * the announcer. Adding expo-speech (or a bundled local voice) here is the only
 * change needed to light it up.
 */
export const speech: SpeechPort = {
  available: false,
  cancel(): void {
    // No voice to stop.
  },
  speak(): void {
    // Intentionally silent; `available` tells callers not to offer this.
  },
};
