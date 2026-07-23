# Recognition training

Richii uses a two-stage guided recognizer: deterministic crop localization followed by a compact ONNX tile classifier. This keeps the runtime small and makes capture failures visible instead of asking a detector to infer arbitrary table layouts.

The recognizer consumes exactly 15 crops per pass: 14 concealed/winning tiles and one dora indicator. Web lazy-loads the WebGL runtime; native uses ONNX Runtime React Native. Confidence below `0.75`, unknown classes, impossible tile counts, and uncertain winner placement remain in review.

## Reproduce the classifier

The seed artwork is the CC0 [`FluffyStuff/riichi-mahjong-tiles`](https://github.com/FluffyStuff/riichi-mahjong-tiles) repository at commit `26e127ba2117f45cdce5ea0225748cc0cfad3169`.

```sh
git clone https://github.com/FluffyStuff/riichi-mahjong-tiles.git /tmp/richii-tiles-source
git -C /tmp/richii-tiles-source checkout 26e127ba2117f45cdce5ea0225748cc0cfad3169
python3 -m venv /tmp/richii-vision-venv
/tmp/richii-vision-venv/bin/pip install torch torchvision onnx onnxruntime
/tmp/richii-vision-venv/bin/python scripts/vision/prepare-physical-crops.py \
  --manifest scripts/vision/physical-photo-crops.json \
  --output /tmp/richii-physical-crops
/tmp/richii-vision-venv/bin/python scripts/vision/train-tile-classifier.py \
  --assets /tmp/richii-tiles-source/Export/Regular \
  --real-crops /tmp/richii-physical-crops \
  --real-samples-per-crop 24 \
  --output apps/client/assets/models/tile-classifier-v1.onnx \
  --report docs/recognition-model-v1-report.json
/tmp/richii-vision-venv/bin/python scripts/vision/evaluate-physical-crops.py \
  --model apps/client/assets/models/tile-classifier-v1.onnx \
  --training-report docs/recognition-model-v1-report.json \
  --crops /tmp/richii-physical-crops \
  --output docs/recognition-physical-v1-report.json
```

Synthetic validation measures whether the training and export pipeline works; it is not physical-photo release evidence. Public-domain physical-photo smoke evaluation and representative guided-hand evaluation are reported separately.

## Synthetic-physical 3D renders (Blender)

`render_tiles.py` is a headless Blender 5.1+ generator that renders standing riichi tiles from the same pinned CC0 glyph artwork as physically based 3D objects — ivory body, engraved glyph, glossy coat — under randomized camera pose, studio softbox lighting, and surface imperfections. Its value over the 2D augmentation in `train-tile-classifier.py` is realistic 3D lighting, specular glare, reflection, and geometry that flat compositing cannot express.

```sh
# Blender 5.1+ on PATH; reuses the /tmp/richii-tiles-source clone above.
blender -b -P scripts/vision/render_tiles.py -- \
  --glyphs /tmp/richii-tiles-source/Export/Regular \
  --output /tmp/richii-render-crops \
  --samples-per-class 8 --seed 1234
```

Output is `<output>/train/<label>/*.png`, the exact layout `train-tile-classifier.py --real-crops` already consumes, so the renders act as a third training source alongside the 2D-synthetic and real-photo crops. Tiles are modelled two-tone like real riichi tiles — a bone-white glyph face with a warm yellow/amber back and sides. Randomization covers camera pose, focal length, depth of field, camera roll, studio lighting, white-balance drift, and per-tile surface imperfection. `tile_base.blend` is a self-contained reference scene for visual inspection; `render_tiles.py` is the authoritative, procedural generator.

These renders are **training-side only**. They are written to the `train` partition and must never enter `eval` — held-out evaluation stays real, source-separated physical photos. Their worth is measured solely by lift on the real held-out crops via `evaluate-physical-crops.py`, never as release evidence. Two controlled A/B runs to date show renders are harmless-to-marginal, not a promotion lever (see the recognition audit). A sample render is in `docs/recognition-render-sample.png`.

### Phase 2 — full-hand layouts with boxes (scaffolding)

`--mode hand` renders 14 hand tiles plus a winning-gap and one dora indicator, emitting `<output>/hands/hand-###.png` alongside a `.json` with per-tile label, role, and 2D bounding box (projected from each tile's geometry).

```sh
blender -b -P scripts/vision/render_tiles.py -- --mode hand \
  --glyphs /tmp/richii-tiles-source/Export/Regular --output /tmp/richii-hands --hands 8
```

This is scaffolding for a **future learned localizer**; the shipped recognizer still uses the deterministic connected-component locator, so nothing consumes it yet. The layout, roles, box projection, lighting, and framing are all implemented and verified: every tile renders its glyph clearly with a tight bounding box (`docs/recognition-hand-sample.png`). Hand mode uses matte faces under a wide front light so face-on tiles do not wash out; it disables raytraced GI (which otherwise bounces the bright faces into a pale wash). The single-tile crop path is the higher-fidelity, glossy generator.

## License and release status

The generated classifier is distributed under `CC-BY-SA-4.0`. Physical-photo training combines one CC BY-SA 3.0 source and two CC BY-SA 4.0 sources under the compatible later license; the glyph seed is CC0. See the model asset README and `physical-photo-crops.json` for provenance and source-separated partitions.

This is a conservative beta, not a production-accuracy claim. Its 46-crop source-separated physical set is useful for model promotion and regression detection but is far below the 500 complete-hand release gate.
