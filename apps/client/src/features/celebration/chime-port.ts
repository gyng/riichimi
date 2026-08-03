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
  /**
   * Silence anything still ringing.
   *
   * A strike outlives the celebration that ordered it — a deep one rings for
   * four seconds against a two-and-a-half second stamp, which is deliberate at
   * the end of a hand and wrong at the start of the next one. Scoring a second
   * limit hand before the first has finished used to leave the old bell ringing
   * underneath the new one.
   */
  stop(): void;
}
