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
  --output apps/client/assets/models/tile-classifier-v0.onnx \
  --report docs/recognition-model-v0-report.json
/tmp/richii-vision-venv/bin/python scripts/vision/evaluate-physical-crops.py \
  --model apps/client/assets/models/tile-classifier-v0.onnx \
  --training-report docs/recognition-model-v0-report.json \
  --crops /tmp/richii-physical-crops \
  --output docs/recognition-physical-v0-report.json
```

Synthetic validation measures whether the training and export pipeline works; it is not physical-photo release evidence. Public-domain physical-photo smoke evaluation and representative guided-hand evaluation are reported separately.

## License and release status

The generated classifier is distributed under `CC-BY-SA-3.0` because physical-photo training includes [`Majiang2.JPG`](https://commons.wikimedia.org/wiki/File:Majiang2.JPG). The glyph seed is CC0. See the model asset README and `physical-photo-crops.json` for provenance and source-separated partitions.

This is a conservative beta, not a production-accuracy claim. Its nine-crop source-separated physical smoke set is useful for catching obvious regressions but is far below the 500 complete-hand release gate.
