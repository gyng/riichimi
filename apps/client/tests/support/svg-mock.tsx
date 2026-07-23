import { View } from "react-native";
import type { ComponentProps } from "react";

/**
 * Metro compiles tile SVGs into components through react-native-svg-transformer,
 * which Jest does not run. Tests care about the tile's accessible name and
 * behaviour, not its artwork, so the art renders as an inert view here.
 */
export default function SvgMock(props: ComponentProps<typeof View>) {
  return <View {...props} />;
}
