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

Output is `<output>/train/<label>/*.png`, the exact layout `train-tile-classifier.py --real-crops` already consumes, so the renders act as a third training source alongside the 2D-synthetic and real-photo crops. `tile_base.blend` is a self-contained reference scene for visual inspection; `render_tiles.py` is the authoritative, procedural generator.

These renders are **training-side only**. They are written to the `train` partition and must never enter `eval` — held-out evaluation stays real, source-separated physical photos. Their worth is measured solely by lift on the real held-out crops via `evaluate-physical-crops.py`, never as release evidence. A sample render is in `docs/recognition-render-sample.png`.

## License and release status

The generated classifier is distributed under `CC-BY-SA-4.0`. Physical-photo training combines one CC BY-SA 3.0 source and two CC BY-SA 4.0 sources under the compatible later license; the glyph seed is CC0. See the model asset README and `physical-photo-crops.json` for provenance and source-separated partitions.

This is a conservative beta, not a production-accuracy claim. Its 46-crop source-separated physical set is useful for model promotion and regression detection but is far below the 500 complete-hand release gate.
