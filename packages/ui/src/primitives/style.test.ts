import { describe, expect, it } from "vitest";

import { resolveStyle } from "./style";

// Every style in the app passes through here on its way to the DOM, so a mistake
// is a layout or typography regression on every screen at once. These cover the
// places where CSS and the shorthands these styles are written in disagree.
describe("resolveStyle", () => {
  it("passes plain CSS through untouched", () => {
    expect(
      resolveStyle({ backgroundColor: "#FAF6EA", flexDirection: "row", fontSize: 15 }),
    ).toEqual({ backgroundColor: "#FAF6EA", flexDirection: "row", fontSize: 15 });
  });

  describe("array styles", () => {
    it("lets the last member win, the way a conditional override is meant to", () => {
      expect(resolveStyle([{ opacity: 1, padding: 4 }, { opacity: 0.5 }])).toEqual({
        opacity: 0.5,
        padding: 4,
      });
    });

    it("skips the conditionals that did not apply", () => {
      const selected = false;
      expect(resolveStyle([{ padding: 4 }, selected && { padding: 8 }, null, undefined])).toEqual({
        padding: 4,
      });
    });

    it("flattens nested arrays", () => {
      expect(resolveStyle([{ gap: 1 }, [{ gap: 2 }, [{ gap: 3 }]]])).toEqual({ gap: 3 });
    });

    it("drops keys explicitly set to nothing", () => {
      expect(resolveStyle({ color: undefined, width: 10 })).toEqual({ width: 10 });
    });
  });

  describe("line height", () => {
    // React reads a bare number as a multiple of the font size; these styles mean
    // pixels, so 24 must not become 24 times 16.
    it("reads a number as pixels", () => {
      expect(resolveStyle({ lineHeight: 24 })).toEqual({ lineHeight: "24px" });
    });

    it("leaves an authored unit or keyword alone", () => {
      expect(resolveStyle({ lineHeight: "1.4" })).toEqual({ lineHeight: "1.4" });
      expect(resolveStyle({ lineHeight: "normal" })).toEqual({ lineHeight: "normal" });
    });
  });

  describe("monospace", () => {
    // A lone `monospace` makes browsers fall back to their own fixed-pitch size.
    it("names the family twice so the authored size holds", () => {
      expect(resolveStyle({ fontFamily: "monospace" })).toEqual({
        fontFamily: "monospace, monospace",
      });
    });

    it("leaves other families alone", () => {
      expect(resolveStyle({ fontFamily: "serif" })).toEqual({ fontFamily: "serif" });
      expect(resolveStyle({ fontFamily: "YujiBoku" })).toEqual({ fontFamily: "YujiBoku" });
    });
  });

  describe("transform lists", () => {
    it("gives a bare length pixels and a scale none", () => {
      expect(resolveStyle({ transform: [{ translateY: 2 }, { scale: 1.08 }] })).toEqual({
        transform: "translateY(2px) scale(1.08)",
      });
    });

    it("keeps an authored unit", () => {
      expect(resolveStyle({ transform: [{ rotate: "45deg" }, { translateX: "50%" }] })).toEqual({
        transform: "rotate(45deg) translateX(50%)",
      });
    });

    it("passes a ready-made transform string through", () => {
      expect(resolveStyle({ transform: "translateZ(0)" })).toEqual({
        transform: "translateZ(0)",
      });
    });
  });

  describe("horizontal and vertical shorthands", () => {
    it("expands to both edges, having no single CSS property", () => {
      expect(resolveStyle({ paddingHorizontal: 24, paddingVertical: 12 })).toEqual({
        paddingBottom: 12,
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: 12,
      });
      expect(resolveStyle({ marginHorizontal: 8, marginVertical: 4 })).toEqual({
        marginBottom: 4,
        marginLeft: 8,
        marginRight: 8,
        marginTop: 4,
      });
    });

    it("yields to an edge written out by hand, whichever came first", () => {
      expect(resolveStyle({ paddingHorizontal: 24, paddingLeft: 0 })).toEqual({
        paddingLeft: 0,
        paddingRight: 24,
      });
      expect(resolveStyle({ paddingRight: 0, paddingHorizontal: 24 })).toEqual({
        paddingLeft: 24,
        paddingRight: 0,
      });
    });
  });

  describe("shorthand against longhand", () => {
    // CSS resolves these by declaration order. Style blocks here are written
    // alphabetically, which puts `borderWidth` after `borderLeftWidth` and would
    // erase it; the more specific property has to win either way round.
    it("expands a shorthand that a longhand contradicts", () => {
      expect(resolveStyle({ borderLeftWidth: 4, borderWidth: 1 })).toEqual({
        borderBottomWidth: 1,
        borderLeftWidth: 4,
        borderRightWidth: 1,
        borderTopWidth: 1,
      });
    });

    it("holds that precedence in the other key order too", () => {
      expect(resolveStyle({ borderWidth: 1, borderLeftWidth: 4 })).toEqual({
        borderBottomWidth: 1,
        borderLeftWidth: 4,
        borderRightWidth: 1,
        borderTopWidth: 1,
      });
    });

    it("leaves an uncontested shorthand as one declaration", () => {
      expect(resolveStyle({ borderRadius: 8, borderWidth: 1, padding: 24 })).toEqual({
        borderRadius: 8,
        borderWidth: 1,
        padding: 24,
      });
    });

    it("lets a horizontal shorthand beat the broad one it sits inside", () => {
      expect(resolveStyle({ padding: 24, paddingHorizontal: 8 })).toEqual({
        paddingBottom: 24,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 24,
      });
    });

    it("expands only the corners a longhand did not claim", () => {
      expect(resolveStyle({ borderBottomRightRadius: 5, borderRadius: 0 })).toEqual({
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 5,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
      });
    });

    it("resolves an override across array members, not only within one object", () => {
      expect(resolveStyle([{ borderWidth: 1 }, { borderBottomWidth: 3 }])).toEqual({
        borderBottomWidth: 3,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderTopWidth: 1,
      });
    });
  });

  it("resolves nothing to nothing", () => {
    expect(resolveStyle(undefined)).toEqual({});
    expect(resolveStyle(false)).toEqual({});
    expect(resolveStyle([])).toEqual({});
  });
});
