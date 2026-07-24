// Ambient declarations for the non-code files Metro bundles. Shared by every
// project rather than duplicated per package: the client compiles the UI
// package's sources into its own program, so a declaration that lives in only
// one of them leaves the other unable to resolve the import.

declare module "*.onnx" {
  const asset: number;
  export default asset;
}

declare module "*.png" {
  const asset: number;
  export default asset;
}

declare module "*.ttf" {
  const asset: number;
  export default asset;
}

declare module "*.svg" {
  import type { ComponentType } from "react";
  import type { SvgProps } from "react-native-svg";

  const content: ComponentType<SvgProps>;
  export default content;
}
