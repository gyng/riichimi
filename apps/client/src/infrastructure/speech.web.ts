import type { SpeechPort } from "../features/announcer/speech-port";

function synthesis(): SpeechSynthesis | null {
  const candidate: unknown = globalThis.speechSynthesis;
  return typeof candidate === "undefined" || candidate === null ? null : globalThis.speechSynthesis;
}

export const speech: SpeechPort = {
  get available(): boolean {
    return synthesis() !== null;
  },
  cancel(): void {
    synthesis()?.cancel();
  },
  speak(text: string): void {
    const voice = synthesis();
    if (voice === null) {
      return;
    }
    const utterance = new globalThis.SpeechSynthesisUtterance(text);
    // Voice direction: deliberate and deep, so a called hand lands with weight
    // rather than being rattled off. Web Speech has no emotion prompt, so the
    // drama is carried by pace and pitch.
    utterance.rate = 0.88;
    utterance.pitch = 0.82;
    // Replace anything still queued: the latest score is the one worth hearing.
    voice.cancel();
    voice.speak(utterance);
  },
};
