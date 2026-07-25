import type { ChangeEvent, ComponentPropsWithRef } from "react";

import { INPUT_BASE } from "./base-style";
import { resolveStyle } from "./style";
import type { StyleProp } from "./style";

export interface TextInputProps extends Omit<ComponentPropsWithRef<"input">, "onChange" | "style"> {
  /** Reports the field's next text, which is all any caller here needs. */
  readonly onChangeText?: (value: string) => void;
  readonly style?: StyleProp;
}

export function TextInput({ onChangeText, style, ...rest }: TextInputProps) {
  return (
    <input
      {...rest}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChangeText?.(event.target.value)}
      style={{ ...INPUT_BASE, ...resolveStyle(style) }}
    />
  );
}
