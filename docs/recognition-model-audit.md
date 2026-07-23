# Physical-tile recognition model audit

Last reviewed: **2026-07-23**

## Decision

Ship Richii's rights-traceable guided recognizer as an offline **beta with mandatory review**. Do not claim production recognition accuracy yet.

The implemented system deliberately narrows the visual problem:

1. The capture guide requires 14 upright, separated hand tiles on a dark plain surface, with a larger gap before the winning tile and one dora indicator below.
2. A deterministic connected-component locator must find exactly those 15 faces. It does not invent missing boxes.
3. A compact fixed-batch ONNX classifier proposes each tile and top alternatives.
4. Confidence below `0.75`, unknown output, uncertain winner placement, and impossible physical counts stay in review.
5. The review desk highlights each affected tile, offers the top three candidates plus the complete legal inventory, and allows atomic winner reassignment.
6. The calculator cannot receive the recognized draft until every review issue is resolved; it then opens with the photograph beside the confirmed hand.

This obtains useful automation now while preserving the manual path for arbitrary table layouts, calls, kans, glare, overlaps, and unfamiliar tile art.

## Shipped candidate

- Model: `apps/client/assets/models/tile-classifier-v0.onnx`
- SHA-256: `078ca9261a43c70ab0a23c5bc384c9742b9c2167cb9c13ebc3901117d68571fa`
- Size: 1,866,535 bytes
- Input: fixed RGB/NCHW `15 × 3 × 64 × 48`
- Classes: 34 canonical tiles, three red fives, and `unknown`
- Runtime: lazy ONNX Runtime WebGL on web; ONNX Runtime React Native on native builds
- License: `CC-BY-SA-3.0`; full attribution is beside the artifact

Training combines deterministic camera-style augmentation of CC0 tile artwork with 33 licensed physical-photo crops. The artifact has 99.375% top-1 accuracy on a 3,040-image independent synthetic holdout and ONNX parity within `1.91e-6`. Synthetic accuracy validates the pipeline; it is not release evidence.

The source-separated physical smoke set has only nine crops: 7/9 top-1 (`77.78%`). At the conservative `0.75` threshold it accepts 2/9, both correct (`100%` accepted accuracy at `22.22%` coverage). The other seven stay in review. These figures justify beta dogfood and the threshold behavior, not broad accuracy claims.

## Rights and provenance

- Seed glyphs: [`FluffyStuff/riichi-mahjong-tiles`](https://github.com/FluffyStuff/riichi-mahjong-tiles), CC0, commit `26e127ba2117f45cdce5ea0225748cc0cfad3169`.
- Physical training source: [`Majiang2.JPG`](https://commons.wikimedia.org/wiki/File:Majiang2.JPG), CC BY-SA 3.0, pinned by source SHA-256.
- Held-out smoke sources: [`Japanese Mahjong Tiles 2.jpg`](https://commons.wikimedia.org/wiki/File:Japanese_Mahjong_Tiles_2.jpg) (public domain), [`Mahjong Tiles (195606345).jpeg`](<https://commons.wikimedia.org/wiki/File:Mahjong_Tiles_(195606345).jpeg>) (CC0), and [`Dora and Wanpai.jpg`](https://commons.wikimedia.org/wiki/File:Dora_and_Wanpai.jpg) (public domain).

Source photos are downloaded only by the reproducible preparation script and are not committed. The manifest pins URL, page, license, SHA-256, exact crop boxes, labels, and train/evaluation partition.

## Alternatives investigated

- `pjura/mahjong_vision` is useful classifier prior art but targets Mahjong Soul screenshots, not physical tiles.
- RiichiCam demonstrates a relevant product workflow, but its model/training artifacts are not publicly redistributable.
- Reviewed Roboflow Universe projects expose relevant physical annotations, but no reviewed candidate combined all Richii classes, immutable redistributable weights, acceptable provenance, and exact-hand evaluation. Dataset access also required hosted credentials.
- The reviewed Kaggle corpus claimed MIT metadata while describing images scraped from search/marketplace sites; that is not a sufficient rights chain for a shipped model.
- Ultralytics-based export routes introduce an AGPL/commercial-license decision Richii has not approved.

The local pipeline was selected because every committed artifact has a reproducible, auditable rights chain and avoids a hosted inference dependency.

## Production acceptance contract

`@richii/vision` exposes `evaluateRecognitionModelRelease`. Production approval still requires:

- immutable artifact integrity and HTTPS provenance;
- an SPDX license and every supported class;
- a named representative evaluation set with at least 500 complete hands;
- at least 99.5% per-tile top-1 accuracy;
- at least 93% exact-hand accuracy before correction; and
- reviewed unknown recall, calibration, per-tile-set slices, latency, memory, and real iOS/Android/web device behavior.

The v0 beta does **not** pass this gate because it has no 500-hand representative set or exact-hand accuracy result.

## Evidence still required

1. Collect consented, rights-cleared full guided hands across tile sets, phones, lighting, glare, perspective, red fives, and hard negatives.
2. Keep training/evaluation source-separated and publish tile-family slices.
3. Measure exact-hand accuracy, correction burden, unknown recall, initialization, inference latency, and peak memory on representative devices.
4. Add native custom-development-build and real-device camera checks; the ONNX native module is not available in Expo Go.
5. Promote the beta only when the release manifest passes without overriding a threshold.
