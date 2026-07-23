# Richii guided tile classifier v0

`tile-classifier-v0.onnx` is Richii's locally trained beta tile-face classifier.

- Artifact SHA-256: `078ca9261a43c70ab0a23c5bc384c9742b9c2167cb9c13ebc3901117d68571fa`
- Input: 15 RGB crops, NCHW `15 × 3 × 64 × 48`, normalized to `[-1, 1]`
- Output: logits for 34 canonical tiles, three red fives, and `unknown`
- Artifact license: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- Status: beta; mandatory human review; not approved by the production release gate

Attribution and provenance:

- CC0 tile artwork from [`FluffyStuff/riichi-mahjong-tiles`](https://github.com/FluffyStuff/riichi-mahjong-tiles), pinned at commit `26e127ba2117f45cdce5ea0225748cc0cfad3169`.
- Physical training crops derived from [`Majiang2.JPG`](https://commons.wikimedia.org/wiki/File:Majiang2.JPG), licensed CC BY-SA 3.0. The source file is pinned by SHA-256 in `scripts/vision/physical-photo-crops.json`.

No source photographs are bundled. The crop manifest, deterministic trainer, artifact report, and source-separated smoke report are committed so the artifact can be audited and reproduced.
