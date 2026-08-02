/**
 * Fetch the neural speech engine at runtime instead of bundling it.
 *
 * The voice is a download either way — its weights are about 90 MB from the
 * Hugging Face hub — so making the code a download too is the consistent
 * choice, and it is the only one that keeps the cost off everyone else.
 * Bundled, `kokoro-js` brings the transformers runtime (1.3 MB of JavaScript)
 * and a 21.6 MB ONNX WASM binary into every deploy: six times the size of the
 * whole app, shipped to every player, for a voice that is off by default. The
 * bundler cannot be talked out of the WASM either — it arrives through
 * `new URL(…, import.meta.url)`, which `external` does not intercept, and every
 * pattern broad enough to catch it also catches the scanner's own
 * onnxruntime-web and stops guided reads working.
 *
 * `kokoro-js` is therefore not installed at all, not even for types. Installing
 * it pulls `@huggingface/transformers` and `sharp`, which carry high-severity
 * libvips advisories with no fix available — a real finding in `npm audit` for
 * code that never ships. The few types this file needs are declared below, and
 * the module they describe is validated when it arrives.
 */

/** The published ONNX conversion of Kokoro 82M, pinned. */
const KOKORO = "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm";

/** What `generate` hands back: mono PCM and the rate to play it at. */
export interface SynthesizedAudio {
  readonly audio: Float32Array;
  readonly sampling_rate: number;
}

export interface KokoroEngine {
  generate(
    text: string,
    options: { readonly voice: string; readonly speed: number },
  ): Promise<SynthesizedAudio>;
}

interface KokoroModule {
  readonly KokoroTTS: {
    from_pretrained(
      model: string,
      options: {
        readonly device: "wasm";
        readonly dtype: "q8";
        readonly progress_callback: (event: unknown) => void;
      },
    ): Promise<KokoroEngine>;
  };
}

function isKokoroModule(value: unknown): value is KokoroModule {
  if (typeof value !== "object" || value === null || !("KokoroTTS" in value)) {
    return false;
  }
  const { KokoroTTS } = value;
  return (
    typeof KokoroTTS === "object" &&
    KokoroTTS !== null &&
    "from_pretrained" in KokoroTTS &&
    typeof KokoroTTS.from_pretrained === "function"
  );
}

/**
 * Isolated so tests have a seam: everything below this line is a network fetch
 * of third-party code, which no test should perform.
 */
export async function loadKokoroModule(): Promise<KokoroModule> {
  // The specifier is a runtime value on purpose — a literal would let the
  // bundler resolve and inline the whole engine, which is the thing being
  // avoided.
  const loaded: unknown = await import(/* @vite-ignore */ KOKORO);
  // Code fetched over the network is external input like any other. A CDN that
  // answers with something unexpected should surface as a failed voice, not as
  // a crash somewhere further in.
  if (!isKokoroModule(loaded)) {
    throw new Error("The speech engine did not load the expected shape.");
  }
  return loaded;
}
