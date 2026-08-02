import type { AnnouncerVoice } from "../features/announcer/announcer-preference";
import type { SpeechPort } from "../features/announcer/speech-port";
import { kokoroSpeech } from "./kokoro-speech";
import { speech } from "./speech";

/**
 * Pick the engine behind the port.
 *
 * Only this module knows there is more than one. Callers hold a `SpeechPort`
 * and never learn which voice answered, which is the point of the port: the
 * announcement text, the calculator, and the celebration are unchanged by the
 * choice.
 *
 * `kokoro-speech` is imported statically on purpose — it is a small adapter,
 * and the engine it drives is behind a dynamic import inside it, so the weights
 * and the transformers runtime stay out of the shared entry either way.
 */
export function speechFor(voice: AnnouncerVoice): SpeechPort {
  if (voice === "neural" && kokoroSpeech.available) {
    return kokoroSpeech;
  }
  return speech;
}

/** True when this device can offer a choice at all. */
export function neuralVoiceOffered(): boolean {
  return kokoroSpeech.available;
}
