import * as Speech from "expo-speech";

import type { SpeechPort } from "../features/announcer/speech-port";

/**
 * Native voice through the OS speech synthesizer (expo-speech), which every
 * current iOS and Android build provides. Scoring never depends on this: the
 * announcer is opt-in and degrades to silent if a device has no voice.
 */
export const speech: SpeechPort = {
  available: true,
  cancel(): void {
    void Speech.stop();
  },
  speak(text: string): void {
    // Replace anything still queued: the latest score is the one worth hearing.
    void Speech.stop();
    Speech.speak(text);
  },
};
