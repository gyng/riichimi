import { describe, expect, it } from "vitest";

import { BOX_BASE, INPUT_BASE, PRESSABLE_BASE, TEXT_BASE } from "./base-style";

/*
 * React clears a style property that disappears between two renders by assigning
 * "". Doing that to one component of a shorthand deletes it from the declaration,
 * and the property falls back to its CSS initial value rather than to what the
 * shorthand said. A reset written as `border: 0 solid black` therefore turned into
 * a 3px black frame (`medium`, the initial width) on any box that stopped
 * declaring a border between renders — which is what happened to the table's
 * player grid. Longhands cannot come apart that way.
 */
const RISKY_SHORTHANDS = ["border", "borderBlock", "borderInline", "font", "outline"];

describe("primitive base styles", () => {
  const bases = [
    ["BOX_BASE", BOX_BASE],
    ["TEXT_BASE", TEXT_BASE],
    ["PRESSABLE_BASE", PRESSABLE_BASE],
    ["INPUT_BASE", INPUT_BASE],
  ] as const;

  it.each(bases)("states %s with no shorthand that could fall apart", (_name, base) => {
    expect(Object.keys(base).filter((key) => RISKY_SHORTHANDS.includes(key))).toEqual([]);
  });

  it.each(bases)("resets every border edge of %s on its own", (_name, base) => {
    // All three, or a cleared width leaves a visible style behind.
    expect({
      borderColor: base.borderColor,
      borderStyle: base.borderStyle,
      borderWidth: base.borderWidth,
    }).toEqual({ borderColor: "black", borderStyle: "solid", borderWidth: 0 });
  });

  it("lays a box out as a column that does not shrink, the way RN did", () => {
    expect(BOX_BASE.display).toBe("flex");
    expect(BOX_BASE.flexDirection).toBe("column");
    expect(BOX_BASE.flexShrink).toBe(0);
    expect(BOX_BASE.boxSizing).toBe("border-box");
  });

  it("keeps text opaque to the typography around it", () => {
    // A run of text states its own font; a container's must not leak in.
    expect(TEXT_BASE.color).toBe("black");
    expect(TEXT_BASE.fontSize).toBe(14);
    expect(TEXT_BASE.whiteSpace).toBe("pre-wrap");
  });

  it("hands a pressable box the typography of its caller, not the browser's", () => {
    expect(PRESSABLE_BASE.fontFamily).toBe("inherit");
    expect(PRESSABLE_BASE.fontSize).toBe("inherit");
    expect(PRESSABLE_BASE.cursor).toBe("pointer");
  });
});
