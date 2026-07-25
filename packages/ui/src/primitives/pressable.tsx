import { useState } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { PRESSABLE_BASE } from "./base-style";
import { resolveStyle } from "./style";
import type { StyleProp } from "./style";

/** What a control can report about itself while it is being touched. */
export interface PressableState {
  readonly pressed: boolean;
}

export interface PressableProps extends Omit<
  ComponentPropsWithRef<"button">,
  "children" | "onClick" | "style" | "type"
> {
  readonly children?: ReactNode | ((state: PressableState) => ReactNode);
  readonly onPress?: () => void;
  readonly style?: StyleProp | ((state: PressableState) => StyleProp);
}

/**
 * A pressable box. A real `button` rather than a div with a click handler: the
 * browser then supplies keyboard activation, the focus ring, and the disabled
 * semantics for free, and `role` can still name what the control actually is.
 */
export function Pressable({ children, disabled, onPress, style, ...rest }: PressableProps) {
  const [pressed, setPressed] = useState(false);
  const state: PressableState = { pressed };
  const endPress = () => setPressed(false);

  return (
    <button
      type="button"
      {...rest}
      disabled={disabled}
      onClick={onPress}
      onPointerCancel={endPress}
      onPointerDown={() => setPressed(true)}
      onPointerLeave={endPress}
      onPointerUp={endPress}
      style={{
        ...PRESSABLE_BASE,
        ...resolveStyle(typeof style === "function" ? style(state) : style),
      }}
    >
      {typeof children === "function" ? children(state) : children}
    </button>
  );
}
