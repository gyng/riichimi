import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The engine is stubbed at the dynamic-import boundary. What is worth asserting
// is not that Kokoro synthesizes well — that is its job — but that this adapter
// keeps its promise to the rest of the app: a voice never blocks, never throws
// into a score, and never lets two utterances overlap.
const { generate, fromPretrained } = vi.hoisted(() => ({
  generate: vi.fn<(text: string) => Promise<{ audio: Float32Array; sampling_rate: number }>>(),
  fromPretrained: vi.fn<() => Promise<unknown>>(),
}));

// The seam exists precisely so this is possible: the real one fetches the
// engine from a CDN, which no test should do.
vi.mock("../src/infrastructure/kokoro-engine", () => ({
  loadKokoroModule: () => Promise.resolve({ KokoroTTS: { from_pretrained: fromPretrained } }),
}));

class FakeBufferSource extends EventTarget {
  public buffer: unknown = null;
  public started = false;
  public stopped = false;
  connect(): void {}
  start(): void {
    this.started = true;
  }
  stop(): void {
    this.stopped = true;
  }
}

const sources: FakeBufferSource[] = [];

class FakeAudioContext {
  public readonly destination = {};
  public readonly state = "running";
  createBuffer(_channels: number, length: number, rate: number) {
    return { copyToChannel: vi.fn<() => void>(), length, sampleRate: rate };
  }
  createBufferSource() {
    const source = new FakeBufferSource();
    sources.push(source);
    return source;
  }
}

async function freshModule() {
  vi.resetModules();
  return import("../src/infrastructure/kokoro-speech");
}

const audio = { audio: new Float32Array([0, 0.5, -0.5]), sampling_rate: 24_000 };

beforeEach(() => {
  sources.length = 0;
  generate.mockResolvedValue(audio);
  fromPretrained.mockResolvedValue({ generate });
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: FakeAudioContext,
    writable: true,
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "AudioContext");
});

describe("the neural voice adapter", () => {
  it("is unavailable where nothing can play audio", async () => {
    Reflect.deleteProperty(globalThis, "AudioContext");
    const { kokoroSpeech } = await freshModule();

    expect(kokoroSpeech.available).toBe(false);
  });

  it("reports itself available without having fetched anything", async () => {
    const { kokoroSpeech, neuralVoiceState } = await freshModule();

    expect(kokoroSpeech.available).toBe(true);
    // Availability must not trigger a 90 MB download; only speaking does.
    expect(fromPretrained).not.toHaveBeenCalled();
    expect(neuralVoiceState()).toEqual({ kind: "idle" });
  });

  it("speaks without the caller awaiting anything", async () => {
    const { kokoroSpeech } = await freshModule();

    // `speak` returns void by contract: scoring has already been rendered.
    expect(kokoroSpeech.speak("Two han, twenty fu")).toBeUndefined();

    await vi.waitFor(() => {
      expect(sources[0]?.started).toBe(true);
    });
    expect(generate).toHaveBeenCalledWith("Two han, twenty fu", { speed: 1, voice: "af_heart" });
  });

  it("reports the fetch, then readiness, to anyone watching", async () => {
    const { kokoroSpeech, watchNeuralVoice } = await freshModule();
    const seen: string[] = [];
    watchNeuralVoice((state) => seen.push(state.kind));

    kokoroSpeech.speak("Mangan");

    await vi.waitFor(() => {
      expect(seen).toContain("ready");
    });
    expect(seen[0]).toBe("loading");
  });

  it("fetches the engine once, however many wins are announced", async () => {
    const { kokoroSpeech } = await freshModule();

    kokoroSpeech.speak("First");
    await vi.waitFor(() => {
      expect(sources).toHaveLength(1);
    });
    kokoroSpeech.speak("Second");
    await vi.waitFor(() => {
      expect(sources).toHaveLength(2);
    });

    expect(fromPretrained).toHaveBeenCalledTimes(1);
  });

  it("drops an utterance that a newer one overtook", async () => {
    const { kokoroSpeech } = await freshModule();

    kokoroSpeech.speak("The hand nobody waited for");
    kokoroSpeech.speak("The hand that just scored");

    await vi.waitFor(() => {
      expect(sources).toHaveLength(1);
    });
    // Only the newest is heard, and the older one is abandoned before it is
    // synthesized at all — generation is the slow part, so noticing at the end
    // would waste it.
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith("The hand that just scored", expect.anything());
  });

  it("stops what is playing when cancelled", async () => {
    const { kokoroSpeech } = await freshModule();
    kokoroSpeech.speak("Riichi, tsumo, pinfu");
    await vi.waitFor(() => {
      expect(sources[0]?.started).toBe(true);
    });

    kokoroSpeech.cancel();

    expect(sources[0]?.stopped).toBe(true);
  });

  it("reports a failed fetch instead of throwing into the score", async () => {
    fromPretrained.mockRejectedValue(new Error("offline"));
    const { kokoroSpeech, neuralVoiceState, watchNeuralVoice } = await freshModule();
    const seen: string[] = [];
    watchNeuralVoice((state) => seen.push(state.kind));

    expect(() => kokoroSpeech.speak("Haneman")).not.toThrow();

    await vi.waitFor(() => {
      expect(neuralVoiceState().kind).toBe("failed");
    });
    expect(seen).toContain("failed");
    expect(sources).toHaveLength(0);
  });

  it("retries the fetch after a failure rather than staying broken", async () => {
    fromPretrained.mockRejectedValueOnce(new Error("offline"));
    const { kokoroSpeech, neuralVoiceState } = await freshModule();

    kokoroSpeech.speak("First try");
    await vi.waitFor(() => {
      expect(neuralVoiceState().kind).toBe("failed");
    });

    kokoroSpeech.speak("Second try");

    await vi.waitFor(() => {
      expect(neuralVoiceState().kind).toBe("ready");
    });
  });

  it("tells the caller when the utterance started and ended", async () => {
    const { kokoroSpeech } = await freshModule();
    const onStart = vi.fn<() => void>();
    const onEnd = vi.fn<() => void>();

    kokoroSpeech.speak("Two han, twenty fu", { onEnd, onStart });

    await vi.waitFor(() => {
      expect(onStart).toHaveBeenCalled();
    });
    expect(onEnd).not.toHaveBeenCalled();

    sources[0]?.dispatchEvent(new Event("ended"));

    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
