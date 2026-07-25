// Ambient declarations for the non-code files the bundler resolves. Shared by
// every project rather than duplicated per package: the client compiles the UI
// package's sources into its own program, so a declaration that lives in only
// one of them leaves the other unable to resolve the import.

// A CSS module resolves to its class-name map. Typed as a record rather than
// generated per file: a name that is not in the stylesheet reads as `undefined`,
// which `classNames` drops — so a typo shows up as a missing style, and the
// stylesheet stays the single place the names are written.
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

// A plain stylesheet is imported for its side effect only.
declare module "*.css";

// The web (Vite) build resolves these assets to their served URL strings.
declare module "*.onnx" {
  const asset: string;
  export default asset;
}

declare module "*.png" {
  const asset: string;
  export default asset;
}

declare module "*.ttf" {
  const asset: string;
  export default asset;
}

declare module "*.svg" {
  import type { ComponentType, SVGProps } from "react";

  // svgr emits plain DOM <svg> React components for the web build.
  const content: ComponentType<SVGProps<SVGSVGElement>>;
  export default content;
}
