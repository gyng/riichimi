import type { ComponentPropsWithRef } from "react";

import { BOX_BASE } from "./base-style";
import { resolveStyle } from "./style";
import type { StyleProp } from "./style";

export interface ViewProps extends Omit<ComponentPropsWithRef<"div">, "style"> {
  readonly style?: StyleProp;
}

/** A layout box: a `div` that starts from the column-flex reset in `BOX_BASE`. */
export function View({ style, ...rest }: ViewProps) {
  return <div {...rest} style={{ ...BOX_BASE, ...resolveStyle(style) }} />;
}
