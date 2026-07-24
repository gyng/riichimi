import type { SpeakOptions, SpeechPort } from "../features/announcer/speech-port";

function synthesis(): SpeechSynthesis | null {
  const candidate: unknown = globalThis.speechSynthesis;
  return typeof candidate === "undefined" || candidate === null ? null : globalThis.speechSynthesis;
}

// Prefer a natural/neural voice: OS voices vary wildly, and the ones marked
// neural/natural/enhanced are a large jump over the default robotic fallback.
// English first, since the announcement is romaji and English words.
function rank(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = 0;
  if (/neural|natural|enhanced|premium/.test(name)) {
    score += 6;
  }
  if (/google|microsoft|siri|samantha|daniel/.test(name)) {
    score += 3;
  }
  if (lang.startsWith("en")) {
    score += 2;
  }
  if (lang === "en-us" || lang === "en-gb") {
    score += 1;
  }
  return score;
}

let chosen: SpeechSynthesisVoice | null = null;

function bestVoice(voice: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = voice.getVoices();
  if (voices.length === 0) {
    return chosen; // voices load asynchronously; keep whatever we had
  }
  chosen = voices.reduce<SpeechSynthesisVoice | null>(
    (best, candidate) => (best === null || rank(candidate) > rank(best) ? candidate : best),
    null,
  );
  return chosen;
}

const voice = synthesis();
if (voice !== null) {
  // Voices populate asynchronously on most browsers; refresh the pick when they do.
  voice.addEventListener("voiceschanged", () => bestVoice(voice));
  bestVoice(voice);
}

export const speech: SpeechPort = {
  get available(): boolean {
    return synthesis() !== null;
  },
  cancel(): void {
    synthesis()?.cancel();
  },
  speak(text: string, options?: SpeakOptions): void {
    const voices = synthesis();
    if (voices === null) {
      return;
    }
    const utterance = new globalThis.SpeechSynthesisUtterance(text);
    const picked = bestVoice(voices);
    if (picked !== null) {
      utterance.voice = picked;
    }
    // Voice direction: deliberate and deep, so a called hand lands with weight.
    utterance.rate = 0.9;
    utterance.pitch = 0.82;
    if (options?.onStart !== undefined) {
      utterance.onstart = options.onStart;
    }
    if (options?.onEnd !== undefined) {
      utterance.onend = options.onEnd;
    }
    // Replace anything still queued: the latest score is the one worth hearing.
    voices.cancel();
    voices.speak(utterance);
  },
};
