# Tile art

Last reviewed: **2026-07-24**

## Provenance

Tile faces come from [FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles), the "Regular" vector set.

The upstream work is dedicated to the **public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)**, so no attribution is required. It is recorded here anyway: knowing where a bundled asset came from is worth more than the licence strictly demands, and it lets a future reader re-derive the files.

## Why the files in `packages/ui/assets/tiles` are not the upstream files

`scripts/tiles/prepare-tile-assets.py` regenerates them from a checkout of the source repository. Three transformations are applied, each for a reason that would otherwise bite at runtime:

1. **Front and face are merged.** Upstream ships each face as a transparent overlay meant to be drawn on `Front.svg`. Compositing once, at preparation time, means one component per tile instead of two layers to keep aligned.
2. **Ids are namespaced per tile.** Gradient ids repeat across the upstream files. Several tiles render on one page and SVG ids share a document-wide namespace on web, so without a prefix one tile's gradient silently repaints another's.
3. **Editor metadata, unused defs, and excess precision are dropped.** These are Inkscape exports carrying dead gradients, unused arrow markers, and ten-decimal coordinates. Removing them takes the set from 776KB to 437KB with no visible difference at tile size.

`xlink:href` is also rewritten to SVG2's plain `href`, because the namespaced form serialises with a generated prefix that JSX rejects.

To regenerate:

```sh
git clone --depth 1 https://github.com/FluffyStuff/riichi-mahjong-tiles.git
python3 scripts/tiles/prepare-tile-assets.py \
  --source riichi-mahjong-tiles/Regular \
  --output packages/ui/assets/tiles
```

## Rendering

Metro compiles the SVGs into components through `react-native-svg-transformer`, so the art is vector on both web and native. Jest does not run that transformer, so component tests map `.svg` to an inert view — tests assert a tile's accessible name and behaviour, never its artwork.

Rank labels (`5p`, `3s`) can be overlaid in the tile corner from Setup. They are off by default, since the faces are the real thing and a label is a learning aid rather than the default reading.
