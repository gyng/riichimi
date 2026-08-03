import type { SpeakOptions, SpeechPort, SpokenLine } from "../features/announcer/speech-port";
import type { NeuralSpeaker } from "../features/announcer/announcer-preference";
import { kanaToPhonemes } from "../features/announcer/kana-phonemes";
import type { KokoroEngine } from "./kokoro-engine";
import { loadKokoroModule } from "./kokoro-engine";

/**
 * A neural voice that runs on the device, behind the same port as the browser's.
 *
 * The engine and its weights are large and are fetched from the Hugging Face
 * hub the first time someone asks for this voice — never at startup, never as
 * part of the build. Everything here is therefore lazy and failure-tolerant:
 * scoring must not wait for a voice, and a device that cannot fetch the model
 * must still be able to score a hand.
 */

/** The published ONNX conversion of Kokoro 82M. */
const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";

/** Quantized weights: about a quarter of the download for a voice this short. */
const PRECISION = "q8";

/**
 * The English speaker used only when the Japanese path is unavailable.
 *
 * kokoro-js exposes English voices alone, because its own reader speaks
 * English. The weights carry five Japanese speakers, and the model takes
 * phonemes directly, so this adapter reads the announcement itself and reaches
 * them — an American voice saying "Tsumo. Riichi." was never the intent.
 */
const FALLBACK_VOICE = "af_heart";

let speaker: NeuralSpeaker = "jf_alpha";
let pace = 1.1;

/** Which Japanese speaker reads a win, and how quickly. Set from Setup. */
export function setNeuralSpeaker(next: NeuralSpeaker): void {
  speaker = next;
}

export function setNeuralPace(next: number): void {
  pace = next;
}

export type NeuralVoiceState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading"; readonly progress: number }
  | { readonly kind: "ready" }
  /** Turning a line into audio. Short, but not instant, and silent until done. */
  | { readonly kind: "generating" }
  | {
      readonly kind: "failed";
      readonly reason: string;
      /** Which step gave up: the download, or reading Japanese once it had. */
      readonly stage: "fetch" | "japanese";
    };

type Listener = (state: NeuralVoiceState) => void;

type Engine = KokoroEngine;

let engine: Engine | null = null;
let loading: Promise<Engine> | null = null;
let state: NeuralVoiceState = { kind: "idle" };
const listeners = new Set<Listener>();

function announce(next: NeuralVoiceState): void {
  state = next;
  for (const listener of listeners) {
    listener(next);
  }
}

export function neuralVoiceState(): NeuralVoiceState {
  return state;
}

export function watchNeuralVoice(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function load(): Promise<Engine> {
  const { KokoroTTS } = await loadKokoroModule();
  return KokoroTTS.from_pretrained(MODEL, {
    device: "wasm",
    dtype: PRECISION,
    progress_callback: (event: unknown) => {
      // The callback reports several event shapes; only the download-progress
      // one carries a number, and the rest just mean "still working".
      const progress =
        typeof event === "object" && event !== null && "progress" in event
          ? Number(event.progress)
          : Number.NaN;
      announce({ kind: "loading", progress: Number.isFinite(progress) ? progress / 100 : 0 });
    },
  });
}

/**
 * Start fetching the voice. Safe to call repeatedly: the first call owns the
 * download and the rest await it.
 */
export function prepareNeuralVoice(): Promise<Engine | null> {
  if (engine !== null) {
    return Promise.resolve(engine);
  }
  loading ??= load()
    .then((ready) => {
      engine = ready;
      announce({ kind: "ready" });
      return ready;
    })
    .catch((error: unknown) => {
      loading = null;
      announce({
        kind: "failed",
        reason: error instanceof Error ? error.message : "The voice could not be loaded.",
        stage: "fetch",
      });
      throw error;
    });
  announce({ kind: "loading", progress: 0 });
  return loading.catch(() => null);
}

let context: AudioContext | null = null;
let playing: AudioBufferSourceNode | null = null;
// Only the newest request should be heard. An utterance that lost the race has
// to know it, because generation is slow enough for two to overlap.
let generation = 0;

function audioContext(): AudioContext | null {
  const Constructor = globalThis.AudioContext;
  if (Constructor === undefined) {
    return null;
  }
  context ??= new Constructor();
  return context;
}

function stop(): void {
  generation += 1;
  playing?.stop();
  playing = null;
}

/**
 * Reads the Japanese line with a Japanese speaker where it can, and falls back
 * to the romanized line rather than going silent if anything about the phoneme
 * path fails — a voice must never be the reason a score goes unheard.
 */
async function synthesize(ready: KokoroEngine, line: SpokenLine) {
  const phonemes = kanaToPhonemes(line.japanese);
  if (phonemes !== "") {
    try {
      // Deliberately not registering the speaker in `voices` first: that
      // registry is a frozen getter, and writing to it throws under strict mode
      // — which sent every Japanese line down the English fallback. Only
      // `generate` consults it, and this path does not go through `generate`.
      const { input_ids } = ready.tokenizer(phonemes, { truncation: true });
      return await ready.generate_from_ids(input_ids, { speed: pace, voice: speaker });
    } catch (error: unknown) {
      // Falling back is right — a voice must never be why a score goes unheard
      // — but silently was not: it hid an English voice reading a Japanese
      // announcement for a whole release.
      announce({
        kind: "failed",
        reason: error instanceof Error ? error.message : "unknown",
        stage: "japanese",
      });
    }
  }
  return ready.generate(line.romaji, { speed: pace, voice: FALLBACK_VOICE });
}

async function say(
  line: SpokenLine,
  options: SpeakOptions | undefined,
  token: number,
): Promise<void> {
  const ready = await prepareNeuralVoice();
  const output = audioContext();
  if (ready === null || output === null || token !== generation) {
    return;
  }
  announce({ kind: "generating" });
  const audio = await synthesize(ready, line);
  if (token !== generation) {
    return;
  }
  announce({ kind: "ready" });
  // Copy into a plainly-backed array: with threading enabled the runtime hands
  // back a SharedArrayBuffer view, which Web Audio will not take.
  const samples = new Float32Array(audio.audio);
  const buffer = output.createBuffer(1, samples.length, audio.sampling_rate);
  buffer.copyToChannel(samples, 0);
  const source = output.createBufferSource();
  source.buffer = buffer;
  source.connect(output.destination);
  source.addEventListener(
    "ended",
    () => {
      if (playing === source) {
        playing = null;
      }
      options?.onEnd?.();
    },
    { once: true },
  );
  playing = source;
  // Autoplay policy suspends a context created before a gesture; the win that
  // triggers this came from one, so resuming here is allowed.
  if (output.state === "suspended") {
    await output.resume();
  }
  options?.onStart?.();
  source.start();
}

export const kokoroSpeech: SpeechPort = {
  get available(): boolean {
    // The engine is fetched on demand, so availability is about whether this
    // device can play the result at all.
    return globalThis.AudioContext !== undefined;
  },
  cancel(): void {
    stop();
  },
  speak(line: SpokenLine, options?: SpeakOptions): void {
    stop();
    const token = generation;
    // Fire and forget by design: a voice must never delay or fail a score.
    void say(line, options, token).catch(() => {
      announce({ kind: "failed", reason: "The voice could not speak.", stage: "fetch" });
    });
  },
};
