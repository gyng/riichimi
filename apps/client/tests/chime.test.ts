import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Web Audio through a hand-written fake graph. What is worth asserting is not
 * how the bell sounds — that is a matter of partials and taste — but that a
 * strike can be silenced, because a deep one rings for four seconds against a
 * two-and-a-half second stamp and would otherwise still be sounding when the
 * next hand is celebrated.
 */
class FakeParam {
  public value = 1;
  public readonly ramps: number[] = [];
  public cancelled = 0;
  cancelScheduledValues(): void {
    this.cancelled += 1;
  }
  setValueAtTime(value: number): void {
    this.value = value;
  }
  exponentialRampToValueAtTime(value: number, at: number): void {
    this.ramps.push(at);
    this.value = value;
  }
}

class FakeSource {
  public started = false;
  public readonly stops: number[] = [];
  public readonly frequency = new FakeParam();
  public type = "sine";
  connect(next: unknown): unknown {
    return next;
  }
  start(): void {
    this.started = true;
  }
  stop(at: number): void {
    this.stops.push(at);
  }
}

class FakeGain {
  public readonly gain = new FakeParam();
  connect(next: unknown): unknown {
    return next;
  }
}

const sources: FakeSource[] = [];

class FakeAudioContext {
  public readonly currentTime = 10;
  public readonly destination = {};
  createGain(): FakeGain {
    return new FakeGain();
  }
  createOscillator(): FakeSource {
    const source = new FakeSource();
    sources.push(source);
    return source;
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
}

async function freshChime() {
  vi.resetModules();
  return import("../src/features/celebration/chime");
}

beforeEach(() => {
  sources.length = 0;
  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: FakeAudioContext,
    writable: true,
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "AudioContext");
});

describe("the celebration bell", () => {
  it("rings a struck bell, and an octave under it for the strike that lands", async () => {
    const { chime } = await freshChime();

    chime.strike(1, { deep: true });

    // Five inharmonic partials, plus the sub that only a deep strike adds.
    expect(sources).toHaveLength(6);
    expect(sources.every((source) => source.started)).toBe(true);
  });

  it("silences what is still ringing when a new celebration starts", async () => {
    const { chime } = await freshChime();
    chime.strike(1, { deep: true });
    const before = sources.map((source) => source.stops.at(-1) ?? 0);

    chime.stop();

    // Every source is brought forward to just after the ramp, rather than being
    // left to finish its own decay over the next celebration.
    for (const [index, source] of sources.entries()) {
      expect(source.stops.at(-1)).toBeCloseTo(10.09, 5);
      expect(source.stops.at(-1)).toBeLessThan(before[index] ?? 0);
    }
  });

  it("ramps down instead of cutting, because a bell stopped dead is a click", async () => {
    const { chime } = await freshChime();
    chime.strike(0.5);

    chime.stop();

    // The last thing scheduled on the way out is a ramp, not a hard stop.
    for (const source of sources) {
      expect(source.stops.at(-1)).toBeGreaterThan(10);
    }
  });

  it("stays quiet about a stop with nothing ringing", async () => {
    const { chime } = await freshChime();

    expect(() => chime.stop()).not.toThrow();
  });

  it("does nothing at all where the device has no audio", async () => {
    Reflect.deleteProperty(globalThis, "AudioContext");
    const { chime } = await freshChime();

    expect(chime.available).toBe(false);
    expect(() => chime.strike(1)).not.toThrow();
    expect(() => chime.stop()).not.toThrow();
    expect(sources).toHaveLength(0);
  });
});
