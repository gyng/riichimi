# Physical-tile recognition model audit

Last reviewed: **2026-08-02**

## Decision

Ship Riichimi's rights-traceable guided recognizer as an offline **beta with mandatory review**. Do not claim production recognition accuracy yet.

The implemented system deliberately narrows the visual problem:

1. The capture guide requires 14 upright, separated hand tiles on a dark plain surface, with a larger gap before the winning tile and one dora indicator below.
2. A deterministic connected-component locator must find exactly those 15 faces. It does not invent missing boxes.
3. A compact fixed-batch ONNX classifier proposes each tile and top alternatives.
4. Confidence below `0.75`, unknown output, uncertain winner placement, and impossible physical counts stay in review.
5. The review desk highlights each affected tile, offers the top three candidates plus the complete legal inventory, and allows atomic winner reassignment.
6. The calculator cannot receive the recognized draft until every review issue is resolved; it then opens with the photograph beside the confirmed hand.

This obtains useful automation now while preserving the manual path for arbitrary table layouts, calls, kans, glare, overlaps, and unfamiliar tile art.

## Capture-quality gate

Inference is not the first response to every image. Before accepting classifier output, the client runs deterministic, offline diagnostics over the same normalized pixel frame:

- clipped-pixel coverage detects severe glare or overexposure before layout;
- normalized bounds reject tiles touching the frame edge;
- hand-height scale and aspect-ratio spread reject excessive perspective after localization; and
- sampled Laplacian variance rejects a located but insufficiently sharp hand.

Each failure produces dedicated recovery guidance and leaves photo replacement, retry, and manual entry available. Thresholds are conservative integration defaults and still require representative phone/device tuning; they are not included in the model's accuracy claim.

## Shipped candidate

- Model: `apps/client/assets/models/tile-classifier-v1.onnx`
- SHA-256: `0fc698d56409c6fe80abfd514867a21330183ef120cfb61dbbeae7eb2eb27e4b`
- Size: 1,866,535 bytes
- Input: fixed RGB/NCHW `15 × 3 × 64 × 48`
- Classes: 34 canonical tiles, three red fives, and `unknown`
- Runtime: lazy ONNX Runtime WebGL, fetched only when a read is requested
- License: `CC-BY-SA-4.0`; full attribution is beside the artifact

Training combines deterministic camera-style augmentation of CC0 tile artwork with 107 licensed physical-photo crops from three source photographs and distinct Japanese tile families. The artifact has 99.44% top-1 accuracy on a 3,040-image independent synthetic holdout and ONNX parity within `2.39e-6`. Synthetic accuracy validates the pipeline; it is not release evidence.

The source-separated physical set now has 46 crops spanning a held-out Japanese tile family, red fives, and three unrelated photographs. V1 scores 43/46 top-1 (`93.48%`), up from V0's 34/46 (`73.91%`) on the same expanded set. At the conservative `0.75` threshold V1 accepts 36/46 and all 36 are correct (`100%` accepted accuracy at `78.26%` coverage), up from `28.26%` coverage. All three wrong predictions remain below threshold and therefore stay in review. These figures justify the V1 beta promotion and materially lower correction burden; they do not establish complete-hand or production accuracy.

Exported-browser dogfood uses a guided composite derived from the held-out CC BY-SA 4.0 tile family. V1 reads all 15 tile classes correctly and asks for two low-confidence confirmations; V0's out-of-distribution demonstration required 15 confirmations. This is one repeatable integration fixture, not part of the 500-hand release set.

## What the evaluation harness measures

`scripts/vision/evaluate-recognizer.py` reports the axes a review gate depends on. The full run for the shipped V1 artifact is in [`recognition-eval-v1-report.json`](recognition-eval-v1-report.json).

**The review gate is doing its job.** All three errors on the held-out set are low-confidence — `0.12`, `0.20`, `0.32`, against a `0.75` threshold — so none is accepted and none reaches a score silently. Confident-wrong reads are 0 of 46.

**Every error is one tap from correct.** Top-3 accuracy is 46/46. The review desk already offers the top three as one-tap choices, so the corpus contains no error that needs the full 37-tile picker. The three confusions are `1s → green`, `west → 1m`, and `green → east`, all from the Kantou family — the honour tiles and the green-dominant `1s`.

**Correction burden is 3.26 reviews per 15-tile hand**, and only 2.5% of hands would clear the gate untouched. That is the number to move, and it is a coverage problem rather than an accuracy problem.

**The model is under-confident, not over-confident.** Expected calibration error is `0.140` and maximum is `0.577`, but only one read sits on the over-confident side: reads at `0.42` confidence are 100% correct. Coverage is being spent on caution the model has not earned in the wrong direction.

**Per-class accuracy is not measurable here.** 36 of the 37 evaluated classes have fewer than three crops. The harness marks those slices `resolvable: false` so a 100% off one sample is not read as evidence.

**Unknown recall is not measurable here.** Every crop is a real tile face, so the corpus measures false unknowns (0 of 46) but never missed ones. Recall needs hard negatives.

### Test-time augmentation and temperature scaling: measured, not promoted

Both were run through the harness against the shipped artifact. Neither is shipped.

**TTA** (5 averaged scale/translate views, no flips — a mirrored tile face is a different glyph) improves top-1 from 93.48% to 95.65%, one crop. It also _lowers_ accepted coverage from 78.26% to 71.74%, because averaging softens confidence, which raises correction burden from 3.26 to 4.24 reviews per hand. For a review-gated scanner that is a net loss: one fewer error in exchange for one more review on every hand. Recorded in [`recognition-eval-v1-tta-report.json`](recognition-eval-v1-tta-report.json).

**Temperature scaling cannot be fitted with this corpus at all.** There is no split available to fit it on. The model is **100% accurate on the training partition**, so negative log-likelihood there falls without bound as confidence sharpens and the fit runs to the edge of the scan (`T = 0.05`); fitting on the evaluation partition would be fitting to the test set. The harness now refuses both rather than emitting a number that looks like a calibration. A third, source-separated validation partition is a prerequisite.

For the record, sharpening does what the calibration curve predicts — at `T = 0.25`, coverage rises to 95.65% and ECE falls to `0.040` — but it also produces the corpus's first confident-wrong read, dropping accepted accuracy below 100%. That trade is exactly the one that needs a validation split to make responsibly.

### The corpus, not the technique, is the blocker

Neither change separates from baseline under 95% Wilson intervals. A **+17.4 point** coverage swing does not separate on 46 crops, because one crop is 2.2 points. The two synthetic-render A/B runs that landed "within noise" were reading the same limit. Until the corpus grows, recognizer tuning cannot be evaluated, and the harness now says so in the report rather than leaving it to judgement.

## Rights and provenance

- Seed glyphs: [`FluffyStuff/riichi-mahjong-tiles`](https://github.com/FluffyStuff/riichi-mahjong-tiles), CC0, commit `26e127ba2117f45cdce5ea0225748cc0cfad3169`.
- Physical training sources: [`Majiang2.JPG`](https://commons.wikimedia.org/wiki/File:Majiang2.JPG) (CC BY-SA 3.0), [`Mahjong eg JP A.jpg`](https://commons.wikimedia.org/wiki/File:Mahjong_eg_JP_A.jpg) (CC BY-SA 4.0), and [`Mahjong eg JP.jpg`](https://commons.wikimedia.org/wiki/File:Mahjong_eg_JP.jpg) (CC BY-SA 4.0), all pinned by source SHA-256.
- Held-out sources: [`Mahjong eg JP Kantou.jpg`](https://commons.wikimedia.org/wiki/File:Mahjong_eg_JP_Kantou.jpg) (CC BY-SA 4.0), [`Japanese Mahjong Tiles 2.jpg`](https://commons.wikimedia.org/wiki/File:Japanese_Mahjong_Tiles_2.jpg) (public domain), [`Mahjong Tiles (195606345).jpeg`](<https://commons.wikimedia.org/wiki/File:Mahjong_Tiles_(195606345).jpeg>) (CC0), and [`Dora and Wanpai.jpg`](https://commons.wikimedia.org/wiki/File:Dora_and_Wanpai.jpg) (public domain).

Source photos are downloaded only by the reproducible preparation script and are not committed. The manifest pins URL, page, license, SHA-256, exact boxes or deterministic grids, labels, and train/evaluation partition. Training/evaluation partitioning happens by source photograph before augmentation.

## Synthetic-physical 3D renders (training augmentation)

`scripts/vision/render_tiles.py` renders standing tiles from the pinned CC0 glyph artwork as physically based 3D objects (ivory body, engraved glyph, glossy coat) in Blender 5.1+ EEVEE, under randomized camera pose, studio softbox lighting, and surface imperfections. It emits labeled face crops in the `train/<label>/` layout that `train-tile-classifier.py --real-crops` already consumes, adding realistic 3D lighting, specular glare, reflection, and geometry that the flat 2D augmentation cannot express.

This is a **training-side augmentation source only**, held to the same discipline as every other synthetic input:

- Renders are written to the `train` partition and must never enter `eval`. Held-out evaluation stays real, source-separated physical photographs.
- Their worth is measured **solely** by lift on the real held-out crops (`evaluate-physical-crops.py`), never by how realistic they look and never as release evidence. No accuracy is claimed from renders.
- Provenance is clean and reproducible: the CC0 FluffyStuff seed pinned at `26e127b`, procedurally built from a committed, seeded script; renders inherit `CC-BY-SA-4.0` like the model.
- `render_tiles.py` is authoritative; `scripts/vision/tile_base.blend` is a self-contained reference scene for inspection.

The renderer does not change the shipped model or the production acceptance contract below. Any promotion still requires the real 500-hand representative set.

### Initial measurement (2026-07-23)

A first controlled A/B added 296 renders (8 per class, uniform weight) to the 107 real training crops, identical hyperparameters, evaluated on the same 46 source-separated held-out real crops:

| Metric                  | real only      | + renders      | Δ       |
| ----------------------- | -------------- | -------------- | ------- |
| top-1                   | 93.48%         | 91.30%         | −2.17pp |
| accepted accuracy @0.75 | 100%           | 100%           | 0       |
| accepted coverage @0.75 | 73.91% (34/46) | 78.26% (36/46) | +4.35pp |

Every delta is one to two crops on a 46-crop set — inside the noise floor. This does **not** establish lift; raw top-1 slipped while confident coverage rose slightly. Renders were ~53% of physical variants at this ratio.

A second run down-weighted the renders to ~1:1 (111 renders, 3 per class) and improved realism (depth of field, white-balance drift, camera roll, stronger engraving, tighter azimuth):

| Metric                  | real only      | + renders (1:1, realism) | Δ       |
| ----------------------- | -------------- | ------------------------ | ------- |
| top-1                   | 93.48%         | 93.48%                   | 0       |
| accepted accuracy @0.75 | 100%           | 100%                     | 0       |
| accepted coverage @0.75 | 73.91% (34/46) | 76.09% (35/46)           | +2.17pp |

Down-weighting removed the top-1 regression (back to parity) and left a one-crop coverage gain — still inside the noise floor. Conclusion after two runs: renders are, at best, harmless-to-marginal; they are **not** a promotion lever. The decisive blocker is measurement resolution — a 46-crop held-out set cannot resolve an effect smaller than ~2 crops. Real progress requires a far larger real held-out set, not more synthetic tuning. The shipped model is unchanged.

## Alternatives investigated

- `pjura/mahjong_vision` is useful classifier prior art but targets Mahjong Soul screenshots, not physical tiles.
- RiichiCam demonstrates a relevant product workflow, but its model/training artifacts are not publicly redistributable.
- Reviewed Roboflow Universe projects expose relevant physical annotations, but no reviewed candidate combined all Riichimi classes, immutable redistributable weights, acceptable provenance, and exact-hand evaluation. Dataset access also required hosted credentials.
- The reviewed Kaggle corpus claimed MIT metadata while describing images scraped from search/marketplace sites; that is not a sufficient rights chain for a shipped model.
- Ultralytics-based export routes introduce an AGPL/commercial-license decision Riichimi has not approved.

The local pipeline was selected because every committed artifact has a reproducible, auditable rights chain and avoids a hosted inference dependency.

## Production acceptance contract

`@riichimi/vision` exposes `evaluateRecognitionModelRelease`. Production approval still requires:

- immutable artifact integrity and HTTPS provenance;
- an SPDX license and every supported class;
- a named representative evaluation set with at least 500 complete hands;
- at least 99.5% per-tile top-1 accuracy;
- at least 93% exact-hand accuracy before correction; and
- reviewed unknown recall, calibration, per-tile-set slices, latency, memory, and real iOS/Android/web device behavior.

The V1 beta does **not** pass this gate because it has no 500-hand representative set or exact-hand accuracy result.

## Evidence still required

1. Collect consented, rights-cleared full guided hands across tile sets, phones, lighting, glare, perspective, red fives, and hard negatives.
2. Keep training/evaluation source-separated and publish tile-family slices.
3. Measure exact-hand accuracy, correction burden, unknown recall, initialization, inference latency, and peak memory on representative devices.
4. Add real-device camera checks across representative phones. Riichimi is browser-only, so this means mobile Safari and Chrome on real hardware rather than a native build.
5. Promote the beta only when the release manifest passes without overriding a threshold.
