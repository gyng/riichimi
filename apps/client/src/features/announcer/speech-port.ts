/**
 * Speaking a result is a device capability, not a scoring concern, so it enters
 * through this narrow port. Today a Web Speech adapter implements it; a local
 * neural voice (Moonshine, Piper) can replace the adapter without touching the
 * announcement or the calculator.
 */
export interface SpeechPort {
  /** False when the device or build offers no voice; callers must degrade quietly. */
  readonly available: boolean;
  cancel(): void;
  speak(text: string): void;
}
