// Ambient declarations for the non-code files Metro bundles. Shared by every
// project rather than duplicated per package: the client compiles the UI
// package's sources into its own program, so a declaration that lives in only
// one of them leaves the other unable to resolve the import.

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
