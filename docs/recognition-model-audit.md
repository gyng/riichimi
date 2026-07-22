# Physical-tile recognition model audit

Last reviewed: **2026-07-23**

## Decision

Do not ship a third-party recognition artifact yet. The reviewed candidates do not provide the combination Richii needs: physical-tile photographs, every supported class, redistributable weights with clear provenance, a portable ONNX artifact, and representative exact-hand evaluation.

Richii therefore keeps camera and gallery photos on the correction path and tells the user when no offline model is installed. This is a deliberate trust boundary, not a simulated inference result.

## Acceptance contract

`@richii/vision` exposes `evaluateRecognitionModelRelease`. A candidate release manifest must include:

- a versioned ONNX artifact with its HTTPS source, byte count, and lowercase SHA-256;
- an SPDX license identifier and HTTPS provenance source;
- all 34 canonical tiles, three red fives, and an `unknown` class;
- a positive RGB/NCHW input shape;
- a named representative evaluation dataset with at least 500 complete hands;
- at least 99.5% per-tile top-1 accuracy; and
- at least 93% exact-hand accuracy before correction.

Passing the manifest is necessary but not sufficient. Per-tile-set slices, unknown recall, calibration, latency, memory, and real iOS/Android/web device behavior remain release gates.

## Candidates reviewed

### `pjura/mahjong_vision`

The model card reports an Apache-2.0 classifier and 99.67% validation accuracy, but it is trained on cropped Mahjong Soul screenshots. It is useful prior art for tile classification, not evidence for detecting and grouping physical tiles under glare, perspective, occlusion, varied artwork, or camera noise. It was not selected. See the [model card](https://huggingface.co/pjura/mahjong_vision/blob/main/README.md).

### Roboflow Universe physical-tile projects

Public projects demonstrate relevant physical-tile annotations and hosted training workflows, but the reviewed pages did not establish a single versioned, redistributable ONNX artifact with full Richii class coverage and exact-hand evaluation. A dataset license does not by itself establish the provenance and redistribution terms of trained weights. See the [example physical-tile project](https://universe.roboflow.com/stefanie-egzg0/mahjong-baq4s-hsm4j) and [Universe dataset-download documentation](https://docs.roboflow.com/universe/download-a-universe-dataset).

Some hosted training/export routes use Ultralytics tooling. Its repository offers AGPL-3.0 and enterprise licensing choices, which require an explicit product licensing decision before distribution; Richii does not silently import those obligations. See the [Ultralytics repository licensing section](https://github.com/ultralytics/ultralytics#license).

## Next evidence required

1. Define and version the supported physical-tile families and capture protocol.
2. Acquire or create a rights-cleared training and evaluation corpus with hard negatives.
3. Train/export a candidate without crossing an unapproved license boundary.
4. Publish immutable artifact metadata and run the manifest gate.
5. Benchmark exact-hand accuracy, review burden, unknown recall, and inference performance on representative devices.
6. Connect the artifact through web and native inference adapters only after those results are reviewed.
