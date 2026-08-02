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

The source-separated physical set now has 46 crops spanning a held-out Japanese tile family, red fives, and three unrelated photographs. V1 scores 43/46 top-1 (`93.48%`), up from V0's 34/46 (`73.91%`) on the same expanded set. At the conservative `0.75` threshold V1 accepts 36/46 and all 36 are correct (`100%` accepted accuracy at `78.26%` coverage), up from `28.26%` coverage. All three wrong predictions remain below threshold and therefore stay in review. These figures justify the V1 beta promotion and materially lower correction burden; they do not establish complete-hand or production accuracy. Read them with "What the held-out set is actually measuring" below: 37 of the 46 crops come from the same photographic series as two thirds of the training set, so 93.48% describes the tile design the model trained on rather than an unfamiliar one.

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

### What the held-out set is actually measuring

The 93.48% figure above is measured almost entirely on the same tile design the model trained on.

Four of the seven source photographs come from one Wikimedia series — `Mahjong eg JP`, `Mahjong eg JP A`, and `Mahjong eg JP Kantou`. Two are in training (74 of 107 crops) and the third is the evaluation set's dominant source (**37 of 46 crops**). The partition is separated by _photograph_, which is what the release gate asks for, but not by _tile design_, which is what generalization needs. "Held-out Japanese tile family" is true of the file and misleading about the tiles.

The corpus contains exactly one visually distinct design — `majiang2`, a Chinese-style set — and it is in **training**, so nothing in the evaluation measures a design the model has not seen.

`scripts/vision/cross-validate.py` measures it by holding out one photographed set at a time and training on the rest. On the corrected corpus:

| Held out          | Crops | Top-1     |
| ----------------- | ----- | --------- |
| `mahjong-eg-jp`   | 37    | **97.3%** |
| `mahjong-eg-jp-a` | 37    | **94.6%** |
| `majiang2`        | 33    | **30.3%** |

The two that generalize are two photographs of the same series, with the third still in training — so they measure recall of a design, not generalization to one. The one genuinely unseen design scores **30.3%**, and out-of-fold accuracy across all 107 real crops is **75.7%** against the 93.48% headline. Full run: [`recognition-cross-validation-report.json`](recognition-cross-validation-report.json).

This is the single most important number in this document. It says the recognizer has learned one tile design and is graded on that design.

### A framing defect in the majiang2 crops

Found by inspecting what the classifier actually receives. All 33 `majiang2` boxes were positioned about 25px too low — roughly a third of a tile — so every crop straddled two tiles:

- the rank numeral was cut off the top of **all nine** man tiles, leaving only the red 萬, which the classifier read as 中: `1m…9m → red`, every one;
- the honour row fell off the tiles into the tray below, and came back `unknown` at up to 0.93 confidence.

Thirty-one percent of the real training photographs were therefore teaching the model that nine different classes look like a red 萬 with no numeral. The boxes are corrected in the manifest and the collapse is gone — the fold's errors are now ordinary confusions (`2m → 1m`, `3m → 1m`) rather than a systematic one.

**It did not improve accuracy.** The `majiang2` fold is 10/33 before and after, and out-of-fold moved 77.6% → 75.7%, comfortably inside the noise on 107 crops. The defect was real and worth removing; the family is simply a design the model has never seen, and cleaning its labels does not teach it one.

Note on provenance: the shipped `tile-classifier-v1.onnx` was trained **before** this correction, so it no longer reproduces byte-identically from the current manifest. Its own report records what produced it; the next promotion picks up the corrected crops.

### Checkpoint selection uses the wrong distribution, and it barely matters

`train-tile-classifier.py` keeps the epoch that scores best on a **synthetic** validation set built from the same CC0 vector artwork it trains on. That signal sits at 99.3–99.4% and saturates, while the quantity that matters moves underneath it. The selection signal is demonstrably not tracking the target.

The per-fold oracle gap is 2.7, 2.7, and 3.0 points — but that is an oracle, optimistic by construction, and the aggregate curve says the practical gain is much smaller. Mean real accuracy across the three folds:

| Epoch     | 1     | 3     | 5     | 6     | 8         | 9         | 10    | 11        | 12    |
| --------- | ----- | ----- | ----- | ----- | --------- | --------- | ----- | --------- | ----- |
| Mean real | 0.684 | 0.742 | 0.750 | 0.751 | **0.760** | **0.760** | 0.741 | **0.760** | 0.750 |

Real accuracy climbs until about epoch 5 and then **plateaus**; it does not peak and decline, so there is no good epoch the synthetic signal is walking past. Choosing one shared epoch by cross-validation instead of per-fold synthetic scores recovers 0.741 → 0.760, which is **two crops in 107** and inside the interval.

So this is a defect worth fixing for its own sake — a selection rule should measure the thing it is selecting for — but it is not an accuracy lever, and it was wrong of this document to imply otherwise. Note also that `majiang2` never exceeds 0.333 at **any** epoch: no training-schedule change touches the generalization problem.

### A candidate trained on the corrected corpus

The shipped V1 trained on the mis-framed `majiang2` crops, so a candidate was trained on the corrected corpus with identical settings and scored on the same held-out 46:

|                            | top-1  | top-3  | coverage | accepted accuracy | confident-wrong | reviews/hand |
| -------------------------- | ------ | ------ | -------- | ----------------- | --------------- | ------------ |
| V1 (shipped)               | 0.9348 | 1.0000 | 0.7826   | 1.0000            | 0               | 3.26         |
| Corrected-corpus candidate | 0.9348 | 1.0000 | 0.7826   | 1.0000            | 0               | 3.26         |

Identical on every metric the gate reads. The models are genuinely different — the three errors moved from `1s → green`, `west → 1m`, `green → east` to `1s → 9s`, `green → east`, `2p → 4p` — but the held-out set cannot tell them apart, because it measures the design both models already know.

**The candidate was not promoted.** There is no measured improvement to justify replacing the artifact, its SHA-256, and the browser fixture that depends on its exact review count. The corrected manifest is in place for the next promotion, when the corpus has a reason to produce one.

This is the clearest demonstration in this document of what the corpus problem costs: a defect was found in a third of the physical training data, corrected, and retrained, and the release metric did not move by one crop.

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
