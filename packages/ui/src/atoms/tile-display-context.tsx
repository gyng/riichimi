import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { TileId } from "@riichimi/score-core";

import { englishTileWords, tileName } from "./tile-name";
import type { TileWords } from "./tile-name";

interface TileDisplay {
  /** Draw a small rank shorthand (5p, 3s) in the tile corner. */
  readonly showRankLabels: boolean;
  /** What to call a tile out loud, in the reader's language. */
  readonly tileName: (tile: TileId) => string;
}

const TileDisplayContext = createContext<TileDisplay>({
  showRankLabels: false,
  tileName: (tile) => tileName(tile),
});

/**
 * Tile appearance and tile vocabulary are both things the app decides once rather
 * than something every caller threads through, so they ride a context. Without a
 * provider the tiles are named in English, which keeps this package usable alone.
 */
export function TileDisplayProvider({
  children,
  showRankLabels,
  tileWords = englishTileWords,
}: {
  readonly children: ReactNode;
  readonly showRankLabels: boolean;
  readonly tileWords?: TileWords;
}) {
  return (
    <TileDisplayContext.Provider
      value={{ showRankLabels, tileName: (tile) => tileName(tile, tileWords) }}
    >
      {children}
    </TileDisplayContext.Provider>
  );
}

export function useTileDisplay(): TileDisplay {
  return useContext(TileDisplayContext);
}
