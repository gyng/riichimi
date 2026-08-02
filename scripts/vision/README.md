# Recognition training

Riichimi uses a two-stage guided recognizer: deterministic crop localization followed by a compact ONNX tile classifier. This keeps the runtime small and makes capture failures visible instead of asking a detector to infer arbitrary table layouts.

The recognizer consumes exactly 15 crops per pass: 14 concealed/winning tiles and one dora indicator. The WebGL runtime is lazy-loaded, fetched only when a read is requested. Confidence below `0.75`, unknown classes, impossible tile counts, and uncertain winner placement remain in review.

## Reproduce the classifier

The seed artwork is the CC0 [`FluffyStuff/riichi-mahjong-tiles`](https://github.com/FluffyStuff/riichi-mahjong-tiles) repository at commit `26e127ba2117f45cdce5ea0225748cc0cfad3169`.

```sh
git clone https://github.com/FluffyStuff/riichi-mahjong-tiles.git /tmp/riichimi-tiles-source
git -C /tmp/riichimi-tiles-source checkout 26e127ba2117f45cdce5ea0225748cc0cfad3169
python3 -m venv /tmp/riichimi-vision-venv
/tmp/riichimi-vision-venv/bin/pip install torch torchvision onnx onnxruntime
/tmp/riichimi-vision-venv/bin/python scripts/vision/prepare-physical-crops.py \
  --manifest scripts/vision/physical-photo-crops.json \
  --output /tmp/riichimi-physical-crops
/tmp/riichimi-vision-venv/bin/python scripts/vision/train-tile-classifier.py \
  --assets /tmp/riichimi-tiles-source/Export/Regular \
  --real-crops /tmp/riichimi-physical-crops \
  --real-samples-per-crop 24 \
  --output apps/client/assets/models/tile-classifier-v1.onnx \
  --report docs/recognition-model-v1-report.json
/tmp/riichimi-vision-venv/bin/python scripts/vision/evaluate-physical-crops.py \
  --model apps/client/assets/models/tile-classifier-v1.onnx \
  --training-report docs/recognition-model-v1-report.json \
  --crops /tmp/riichimi-physical-crops \
  --output docs/recognition-physical-v1-report.json
```

Synthetic validation measures whether the training and export pipeline works; it is not physical-photo release evidence. Public-domain physical-photo smoke evaluation and representative guided-hand evaluation are reported separately.

## Deciding whether a change is real

`evaluate-physical-crops.py` answers "how often is it right". `evaluate-recognizer.py` answers the question a review-gated scanner actually has: does the model know when it is wrong, what does a person have to do about it, and can this corpus tell the difference at all.

```sh
/tmp/riichimi-vision-venv/bin/python scripts/vision/evaluate-recognizer.py \
  --model apps/client/assets/models/tile-classifier-v1.onnx \
  --training-report docs/recognition-model-v1-report.json \
  --crops /tmp/riichimi-physical-crops \
  --output docs/recognition-eval-v1-report.json
```

It reports per-class and per-tile-set accuracy, expected and maximum calibration error with reliability bins, the operating point at a confidence threshold plus a sweep from 0.50 to 0.95, correction burden per scanned hand, and false-unknown rate.

Two features exist to stop the corpus from being read as more than it is:

- **Every rate carries a 95% Wilson interval**, and any slice with fewer than `--minimum-support` crops is marked `resolvable: false`. 36 of the 37 evaluated classes have fewer than three crops, so per-class accuracy is a tally, not a measurement.
- **`--baseline <report>` states whether a difference survives those intervals.** On 46 crops the smallest possible move is one crop, or 2.2 points, so the verdict is usually `within-noise`. That is the honest answer, and it is why the roadmap puts corpus growth ahead of model tuning.

Unknown recall is deliberately **not** reported. Every crop in this corpus is a real tile face, so the corpus can measure false unknowns but never missed ones; measuring recall needs hard negatives — sticks, dice, racks, fingers, patterned tables.

### Holding out a whole tile set

`evaluate-recognizer.py` scores the 46 held-out crops. It cannot say whether the recognizer would cope with a tile design it has never seen, because 37 of those 46 come from the same Wikimedia series as two thirds of the training photographs.

`cross-validate.py` answers that by holding out one photographed set at a time:

```sh
/tmp/riichimi-vision-venv/bin/python scripts/vision/cross-validate.py \
  --assets /tmp/riichimi-tiles-source/Export/Regular \
  --real-crops /tmp/riichimi-physical-crops \
  --output docs/recognition-cross-validation-report.json
```

Each fold trains on two families and validates on the third, so out-of-fold predictions cover all 107 real training crops — more than twice the resolution of the held-out set, without spending any of it. It also reports what checkpoint selection costs: the epoch chosen by synthetic validation against the epoch a real fold would have chosen.

Use it whenever the corpus grows. A new tile set is a new fold, and the fold's accuracy is the closest thing available to "what happens at somebody else's table".

### Test-time augmentation and temperature

`--tta-views N` averages the probabilities of N scale/translate views per crop. There are no flips or rotations: a mirrored tile face is a different glyph, so a flip would average across a class boundary rather than over nuisance variation.

`--fit-temperature-on <partition>` fits a softmax temperature by minimizing NLL on a partition that is not the one being scored. It refuses two mistakes rather than quietly producing a number:

- fitting on the partition being reported, which measures the fit rather than the model;
- fitting on a partition the model separates perfectly, where likelihood improves without bound as confidence sharpens and the fit runs to the edge of the scan.

The second is not hypothetical here — see the audit's calibration note.

## Synthetic-physical 3D renders (Blender)

`render_tiles.py` is a headless Blender 5.1+ generator that renders standing riichi tiles from the same pinned CC0 glyph artwork as physically based 3D objects — ivory body, engraved glyph, glossy coat — under randomized camera pose, studio softbox lighting, and surface imperfections. Its value over the 2D augmentation in `train-tile-classifier.py` is realistic 3D lighting, specular glare, reflection, and geometry that flat compositing cannot express.

```sh
# Blender 5.1+ on PATH; reuses the /tmp/riichimi-tiles-source clone above.
blender -b -P scripts/vision/render_tiles.py -- \
  --glyphs /tmp/riichimi-tiles-source/Export/Regular \
  --output /tmp/riichimi-render-crops \
  --samples-per-class 8 --seed 1234
```

Output is `<output>/train/<label>/*.png`, the exact layout `train-tile-classifier.py --real-crops` already consumes, so the renders act as a third training source alongside the 2D-synthetic and real-photo crops. Tiles are modelled two-tone like real riichi tiles — a bone-white glyph face with a warm yellow/amber back and sides. Randomization covers camera pose, focal length, depth of field, camera roll, studio lighting, white-balance drift, and per-tile surface imperfection. `tile_base.blend` is a self-contained reference scene for visual inspection; `render_tiles.py` is the authoritative, procedural generator.

These renders are **training-side only**. They are written to the `train` partition and must never enter `eval` — held-out evaluation stays real, source-separated physical photos. Their worth is measured solely by lift on the real held-out crops via `evaluate-physical-crops.py`, never as release evidence. Two controlled A/B runs to date show renders are harmless-to-marginal, not a promotion lever (see the recognition audit). A sample render is in `docs/recognition-render-sample.png`.

### Phase 2 — full-hand layouts with boxes (scaffolding)

`--mode hand` renders 14 hand tiles plus a winning-gap and one dora indicator, emitting `<output>/hands/hand-###.png` alongside a `.json` with per-tile label, role, and 2D bounding box (projected from each tile's geometry).

```sh
blender -b -P scripts/vision/render_tiles.py -- --mode hand \
  --glyphs /tmp/riichimi-tiles-source/Export/Regular --output /tmp/riichimi-hands --hands 8
```

This is scaffolding for a **future learned localizer**; the shipped recognizer still uses the deterministic connected-component locator, so nothing consumes it yet. The layout, roles, box projection, lighting, and framing are all implemented and verified: every tile renders its glyph clearly with a tight bounding box (`docs/recognition-hand-sample.png`). Hand mode uses matte faces under a wide front light so face-on tiles do not wash out; it disables raytraced GI (which otherwise bounces the bright faces into a pale wash). The single-tile crop path is the higher-fidelity, glossy generator.

## License and release status

The generated classifier is distributed under `CC-BY-SA-4.0`. Physical-photo training combines one CC BY-SA 3.0 source and two CC BY-SA 4.0 sources under the compatible later license; the glyph seed is CC0. See the model asset README and `physical-photo-crops.json` for provenance and source-separated partitions.

This is a conservative beta, not a production-accuracy claim. Its 46-crop physical set is useful for regression detection but is far below the 500 complete-hand release gate — and it is separated by photograph rather than by tile design, so it measures the design the model trained on. The one held-out design scores 30.3%. See the audit.

The `majiang2` crop boxes were corrected on 2026-08-02 (they were framed 25px too low), so the shipped `tile-classifier-v1.onnx` predates the current manifest and no longer reproduces byte-identically from it. `docs/recognition-model-v1-report.json` records what produced the shipped artifact; the next promotion picks up the corrected crops.
