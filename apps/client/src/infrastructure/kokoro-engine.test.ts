import { describe, expect, it } from "vitest";

import { isKokoroModule } from "./kokoro-engine";

/**
 * The loader fetches third-party code over the network, which no test should
 * do. Its one testable part is the check that decides whether what arrived is
 * usable — and that check is what silently disabled the neural voice: the real
 * export is a class, `typeof` a class is "function", and the guard demanded
 * "object", so the model download was never attempted on any device.
 */
describe("recognizing the speech engine module", () => {
  it("accepts the module as it is actually published: a class", () => {
    // Deliberately a class, because that is the shape the CDN serves and the
    // shape the old check rejected: `typeof` a class is "function".
    class KokoroTTS {
      readonly voice = "af_heart";
      static from_pretrained() {
        return Promise.resolve({});
      }
    }

    expect(typeof KokoroTTS).toBe("function");
    expect(isKokoroModule({ KokoroTTS })).toBe(true);
  });

  it("accepts a plain object exposing the same factory", () => {
    expect(isKokoroModule({ KokoroTTS: { from_pretrained: () => Promise.resolve({}) } })).toBe(
      true,
    );
  });

  it("rejects a module whose factory is missing or not callable", () => {
    expect(isKokoroModule({ KokoroTTS: { from_pretrained: "soon" } })).toBe(false);
    expect(isKokoroModule({ KokoroTTS: {} })).toBe(false);
    expect(isKokoroModule({ KokoroTTS: null })).toBe(false);
  });

  it("rejects anything that is not a module at all", () => {
    // A CDN that answers with an error page, or with nothing.
    expect(isKokoroModule(undefined)).toBe(false);
    expect(isKokoroModule("<!doctype html>")).toBe(false);
    expect(isKokoroModule({})).toBe(false);
  });
});
