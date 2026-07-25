import { describe, expect, it } from "vitest";

import { classNames } from "./class-names";

describe("classNames", () => {
  it("joins the classes that apply", () => {
    expect(classNames("tile", "selected")).toBe("tile selected");
  });

  it("skips a condition that did not hold", () => {
    const selected = false;
    const disabled = true;
    expect(classNames("tile", selected && "selected", disabled && "disabled")).toBe(
      "tile disabled",
    );
  });

  it("skips nothing at all", () => {
    // A CSS module resolves to undefined under a test runner that skips CSS, and
    // a class named nowhere in the stylesheet is undefined at runtime too.
    expect(classNames("tile", undefined, null, "")).toBe("tile");
  });

  it("is empty when nothing applies", () => {
    expect(classNames(false, undefined)).toBe("");
  });
});
