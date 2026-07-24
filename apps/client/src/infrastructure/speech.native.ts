import * as Speech from "expo-speech";

import type { SpeakOptions, SpeechPort } from "../features/announcer/speech-port";

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
  speak(text: string, options?: SpeakOptions): void {
    // Replace anything still queued: the latest score is the one worth hearing.
    void Speech.stop();
    const speechOptions: Speech.SpeechOptions = { pitch: 0.82, rate: 0.9 };
    if (options?.onStart !== undefined) {
      speechOptions.onStart = options.onStart;
    }
    if (options?.onEnd !== undefined) {
      speechOptions.onDone = options.onEnd;
    }
    Speech.speak(text, speechOptions);
  },
};
