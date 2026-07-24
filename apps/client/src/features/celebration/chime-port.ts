/**
 * A short struck-metal sound for the celebration reveal — a bell/kane hit, not
 * quite a gong. It enters through a narrow port so the Web Audio synth (web) can
 * be swapped for a bundled sample or haptics on native without touching the
 * celebration.
 */
export interface ChimePort {
  /** False where no audio path exists; callers must stay silent, not fail. */
  readonly available: boolean;
  /** Strike the bell. `intensity` (0–1) deepens, lengthens, and loudens it. */
  strike(intensity: number): void;
}
