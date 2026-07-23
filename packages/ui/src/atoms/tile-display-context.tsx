import { createContext, useContext } from "react";
import type { ReactNode } from "react";

interface TileDisplay {
  /** Draw a small rank shorthand (5p, 3s) in the tile corner. */
  readonly showRankLabels: boolean;
}

const TileDisplayContext = createContext<TileDisplay>({ showRankLabels: false });

/**
 * Tile appearance is a viewing preference rather than something each caller
 * should thread through, so it rides a context the app sets once.
 */
export function TileDisplayProvider({
  children,
  showRankLabels,
}: {
  readonly children: ReactNode;
  readonly showRankLabels: boolean;
}) {
  return (
    <TileDisplayContext.Provider value={{ showRankLabels }}>{children}</TileDisplayContext.Provider>
  );
}

export function useTileDisplay(): TileDisplay {
  return useContext(TileDisplayContext);
}
