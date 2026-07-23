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
    // Replace anything still queued: the latest score is the one worth hearing.
    voice.cancel();
    voice.speak(new globalThis.SpeechSynthesisUtterance(text));
  },
};
