import type { ComponentPropsWithRef } from "react";

import { resolveStyle } from "./style";
import type { Style, StyleProp } from "./style";

export interface ImageProps extends Omit<ComponentPropsWithRef<"img">, "style"> {
  readonly style?: StyleProp;
}

// An `img` stretches to whatever box it is given; every photo this app shows is
// a captured hand, so filling the frame without distorting it is the useful
// default. Callers that must show the whole frame ask for `contain`.
const IMAGE_BASE = { objectFit: "cover" } as const satisfies Style;

export function Image({ style, ...rest }: ImageProps) {
  return <img {...rest} style={{ ...IMAGE_BASE, ...resolveStyle(style) }} />;
}
