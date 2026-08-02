/** Fires around an utterance so a caller can sync visuals to the voice. */
export interface SpeakOptions {
  readonly onStart?: () => void;
  readonly onEnd?: () => void;
}

/**
 * One line, in both the forms an engine might be able to pronounce.
 *
 * The announcement is Japanese; whether a given device can say it is not the
 * announcement's business. An adapter with a Japanese voice takes `japanese`,
 * and one without takes `romaji` rather than reading kana aloud as noise.
 */
export interface SpokenLine {
  readonly japanese: string;
  readonly romaji: string;
}

/**
 * Speaking a result is a device capability, not a scoring concern, so it enters
 * through this narrow port. Today a Web Speech adapter implements it, tuned for
 * the best available voice and a dramatic delivery; a local neural voice (Piper,
 * Kokoro via ONNX) can replace the adapter without touching the announcement or
 * the calculator.
 */
export interface SpeechPort {
  /** False when the device or build offers no voice; callers must degrade quietly. */
  readonly available: boolean;
  cancel(): void;
  speak(line: SpokenLine, options?: SpeakOptions): void;
}
