/**
 * A short struck-metal sound for the celebration reveal — a bell/kane hit, not
 * quite a gong. It enters through a narrow port so the Web Audio synth (web) can
 * be swapped for a bundled sample or haptics on native without touching the
 * celebration.
 */
export interface StrikeOptions {
  /**
   * The strike that completes the word. It gains an octave underneath and a
   * longer tail — at yakuman the fundamental alone is 210 Hz, which is where a
   * bell sits but not where weight does.
   */
  readonly deep?: boolean;
}

export interface ChimePort {
  /** False where no audio path exists; callers must stay silent, not fail. */
  readonly available: boolean;
  /** Strike the bell. `intensity` (0–1) deepens, lengthens, and loudens it. */
  strike(intensity: number, options?: StrikeOptions): void;
}
