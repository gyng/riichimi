import type { Edge } from "react-native-safe-area-context";

/**
 * The persistent top app bar owns the top safe-area inset, so every screen
 * rendered below it must leave "top" out. Applying it again doubles the padding
 * under a notch or status bar.
 */
export const bodyEdges: readonly Edge[] = ["bottom", "left", "right"];
