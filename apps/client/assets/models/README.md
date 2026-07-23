# Riichimi guided tile classifier v1

`tile-classifier-v1.onnx` is Riichimi's locally trained beta tile-face classifier.

- Artifact SHA-256: `0fc698d56409c6fe80abfd514867a21330183ef120cfb61dbbeae7eb2eb27e4b`
- Input: 15 RGB crops, NCHW `15 × 3 × 64 × 48`, normalized to `[-1, 1]`
- Output: logits for 34 canonical tiles, three red fives, and `unknown`
- Artifact license: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- Status: beta; mandatory human review; not approved by the production release gate

Attribution and provenance:

- CC0 tile artwork from [`FluffyStuff/riichi-mahjong-tiles`](https://github.com/FluffyStuff/riichi-mahjong-tiles), pinned at commit `26e127ba2117f45cdce5ea0225748cc0cfad3169`.
- Physical training crops derived from [`Majiang2.JPG`](https://commons.wikimedia.org/wiki/File:Majiang2.JPG), [`Mahjong eg JP A.jpg`](https://commons.wikimedia.org/wiki/File:Mahjong_eg_JP_A.jpg), and [`Mahjong eg JP.jpg`](https://commons.wikimedia.org/wiki/File:Mahjong_eg_JP.jpg). Their CC BY-SA licenses and source hashes are pinned in `scripts/vision/physical-photo-crops.json`.

No training photographs are bundled. The crop manifest, deterministic trainer, artifact report, and source-separated physical report are committed so the artifact can be audited and reproduced.

`candidates.json` records the immutable V0/V1 hashes, like-for-like physical metrics, active candidate, and retained rollback artifact. Production promotion remains separate from beta candidate promotion and still requires the 500-complete-hand release gate.
