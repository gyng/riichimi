import type { ComponentPropsWithRef } from "react";

import { TEXT_BASE } from "./base-style";
import { resolveStyle } from "./style";
import type { StyleProp } from "./style";

export interface TextProps extends Omit<ComponentPropsWithRef<"div">, "style"> {
  readonly style?: StyleProp;
}

/**
 * A run of text. `dir="auto"` lets the browser infer writing direction, which
 * matters where a label mixes kanji, romaji, and digits.
 */
export function Text({ style, ...rest }: TextProps) {
  return <div dir="auto" {...rest} style={{ ...TEXT_BASE, ...resolveStyle(style) }} />;
}
