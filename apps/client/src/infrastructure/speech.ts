import type { SpeakOptions, SpeechPort, SpokenLine } from "../features/announcer/speech-port";

function synthesis(): SpeechSynthesis | null {
  const candidate: unknown = globalThis.speechSynthesis;
  return typeof candidate === "undefined" || candidate === null ? null : globalThis.speechSynthesis;
}

function isJapanese(voice: SpeechSynthesisVoice): boolean {
  return voice.lang.toLowerCase().startsWith("ja");
}

// Prefer a natural/neural voice: OS voices vary wildly, and the ones marked
// neural/natural/enhanced are a large jump over the default robotic fallback.
// Japanese first — the announcement is Japanese, and a device that has a
// Japanese voice should use it whatever else it offers.
function rank(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = 0;
  if (isJapanese(voice)) {
    score += 20;
  }
  if (/neural|natural|enhanced|premium/.test(name)) {
    score += 6;
  }
  if (/google|microsoft|siri|kyoko|o-ren|otoya|nanami|haruka|samantha|daniel/.test(name)) {
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

let pace = 1.1;

/** The speaking rate the chosen delivery asks for. Set from Setup. */
export function setSpeechPace(next: number): void {
  pace = next;
}

export const speech: SpeechPort = {
  get available(): boolean {
    return synthesis() !== null;
  },
  cancel(): void {
    synthesis()?.cancel();
  },
  speak(line: SpokenLine, options?: SpeakOptions): void {
    const voices = synthesis();
    if (voices === null) {
      return;
    }
    const picked = bestVoice(voices);
    // Kana read by an English voice is noise, not an accent, so a device with
    // no Japanese voice hears the romanized line instead.
    const japanese = picked !== null && isJapanese(picked);
    const utterance = new globalThis.SpeechSynthesisUtterance(
      japanese ? line.japanese : line.romaji,
    );
    if (picked !== null) {
      utterance.voice = picked;
      utterance.lang = picked.lang;
    }
    // Voice direction: the announcer at a parlour, not a newsreader. Bright and
    // quick, the way a called hand is actually shouted across a table. An
    // English voice reading romaji cannot carry that, so it stays lower and
    // more deliberate rather than sounding like a cartoon.
    // A Japanese voice reads the announcement as written and can carry the
    // lift; an English voice reading romaji cannot, so it stays lower and more
    // deliberate rather than sounding like a cartoon.
    utterance.rate = japanese ? pace : Math.min(pace, 1) * 0.95;
    utterance.pitch = japanese ? 1.45 : 0.9;
    if (options?.onStart !== undefined) {
      utterance.addEventListener("start", options.onStart);
    }
    if (options?.onEnd !== undefined) {
      const finish = options.onEnd;
      utterance.addEventListener("end", finish);
      // An utterance that errors never fires `end`, and the announcement chains
      // its second half off that event — so a silent failure would also swallow
      // the celebration waiting behind it.
      utterance.addEventListener("error", () => finish());
    }
    // Only clear the queue when there is something in it. Calling `cancel()`
    // unconditionally immediately before `speak()` is a known way to have the
    // new utterance dropped instead of spoken.
    if (voices.speaking || voices.pending) {
      voices.cancel();
    }
    voices.speak(utterance);
  },
};
