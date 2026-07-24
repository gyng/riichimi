/** Fires around an utterance so a caller can sync visuals to the voice. */
export interface SpeakOptions {
  readonly onStart?: () => void;
  readonly onEnd?: () => void;
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
  speak(text: string, options?: SpeakOptions): void;
}
