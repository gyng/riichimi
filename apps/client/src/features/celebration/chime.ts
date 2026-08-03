import type { ChimePort, StrikeOptions } from "./chime-port";

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof globalThis.AudioContext === "undefined") {
    return null;
  }
  context ??= new globalThis.AudioContext();
  return context;
}

// Inharmonic partials give the metallic, slightly clangorous ring of a struck
// bell rather than the pure tone of a chime — bell-like, but short of a gong.
const PARTIALS: readonly number[] = [1, 2.02, 2.76, 3.99, 5.4];
const PARTIAL_GAINS: readonly number[] = [1, 0.5, 0.4, 0.26, 0.16];

export const chime: ChimePort = {
  get available(): boolean {
    return typeof globalThis.AudioContext !== "undefined";
  },
  strike(intensity: number, options?: StrikeOptions): void {
    const ac = audio();
    if (ac === null) {
      return;
    }
    // A recent tap (the Calculate press) lets a suspended context resume.
    void ac.resume();

    const level = Math.max(0, Math.min(1, intensity));
    const deep = options?.deep ?? false;
    const now = ac.currentTime;
    const fundamental = 300 - level * 90; // deeper for the bigger hands
    const decay = (1.1 + level * 1.4) * (deep ? 1.7 : 1);
    const peak = (0.26 + level * 0.22) * (deep ? 1.15 : 1);

    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(peak, now + 0.006); // sharp strike
    master.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    master.connect(ac.destination);

    if (deep) {
      // An octave under the bell, sine and slow: felt more than heard, which is
      // what makes a big hand land rather than merely ring.
      const sub = ac.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(fundamental / 2, now);
      sub.frequency.exponentialRampToValueAtTime(fundamental / 2.12, now + decay);
      const subGain = ac.createGain();
      subGain.gain.setValueAtTime(0.0001, now);
      subGain.gain.exponentialRampToValueAtTime(0.55 + level * 0.35, now + 0.02);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      sub.connect(subGain).connect(master);
      sub.start(now);
      sub.stop(now + decay);
    }

    PARTIALS.forEach((ratio, index) => {
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(fundamental * ratio, now);
      // A hair of downward glide reads as the metal being struck.
      osc.frequency.exponentialRampToValueAtTime(fundamental * ratio * 0.992, now + decay);
      const gain = ac.createGain();
      gain.gain.value = PARTIAL_GAINS[index] ?? 0.1;
      osc.connect(gain).connect(master);
      osc.start(now);
      osc.stop(now + decay);
    });
  },
};
