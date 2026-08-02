# Tile art

Last reviewed: **2026-08-02**

## Provenance

Tile faces come from [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles), the "Regular" vector set.

The upstream work is dedicated to the **public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)**, so no attribution is required. It is recorded here anyway: knowing where a bundled asset came from is worth more than the licence strictly demands, and it lets a future reader re-derive the files.

## Why the files in `packages/ui/assets/tiles` are not the upstream files

`scripts/tiles/prepare-tile-assets.py` regenerates them from a checkout of the source repository. Three transformations are applied, each for a reason that would otherwise bite at runtime:

1. **Front and face are merged.** Upstream ships each face as a transparent overlay meant to be drawn on `Front.svg`. Compositing once, at preparation time, means one component per tile instead of two layers to keep aligned.
2. **Ids are namespaced per tile.** Gradient ids repeat across the upstream files. Several tiles render on one page and SVG ids share a document-wide namespace on web, so without a prefix one tile's gradient silently repaints another's.
3. **Editor metadata, unused defs, and excess precision are dropped.** These are Inkscape exports carrying dead gradients, unused arrow markers, and ten-decimal coordinates. Removing them takes the set from 776KB to 437KB with no visible difference at tile size.
4. **Ids nothing references are removed.** Inkscape names every shape it ever touched: 1,566 of the set's 1,689 ids were on drawn elements that no `url(#…)` or `href` pointed at. They are dead weight in every rendered tile, and because ids share a document-wide namespace they are also most of what repeats when one tile renders twice. Dropping them leaves 123 — the masks, filter, and cross-referenced glyph paths the art genuinely uses — and takes the set to 407KB. `packages/ui/src/atoms/tile-art.test.ts` reads the assets and fails if a dead id returns.

`xlink:href` is also rewritten to SVG2's plain `href`, because the namespaced form serialises with a generated prefix that JSX rejects.

## What still repeats, and why it is left

An id is unique per tile, not per rendered instance. Two different tiles never collide, but a hand holding two 5p inlines the same document twice, so that tile's three chrome ids — the two bevel masks and the blur filter — appear twice. Nothing renders wrong: the duplicates resolve to identical content and no accessible name points at them.

Fixing it completely means one of two trades, neither of which is worth making for a defect with no visible effect:

- **Scope the ids per instance.** They would have to move out of the SVG and into a component using React's `useId`, which means hand-authoring the tile chrome as TSX and giving up regenerating it from upstream.
- **Replace the SVG bevel with CSS.** The masks exist to clip a blurred highlight and shadow to the tile body's rounded corners. `.tile` already clips, but at the container's radius rather than the artwork's, so the bleed would show in the corner gap. That is a visual change and wants a design decision, not a tidy-up.

To regenerate:

```sh
git clone --depth 1 https://github.com/FluffyStuff/riichi-mahjong-tiles.git
python3 scripts/tiles/prepare-tile-assets.py \
  --source riichi-mahjong-tiles/Regular \
  --output packages/ui/assets/tiles
```

## Rendering

Vite compiles the SVGs into React components through `vite-plugin-svgr`, so the art is vector DOM `<svg>`. Component tests run through the same config and render the real art; they assert a tile's accessible name and behaviour, never its artwork.

Rank labels (`5p`, `3s`) can be overlaid in the tile corner from Setup. They are off by default, since the faces are the real thing and a label is a learning aid rather than the default reading.
