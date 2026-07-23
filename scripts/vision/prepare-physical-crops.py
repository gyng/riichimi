#!/usr/bin/env python3
"""Download, verify, and crop the rights-clear physical-photo corpus."""

from __future__ import annotations

import argparse
import hashlib
import json
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    source_directory = args.output / "sources"
    source_directory.mkdir(parents=True, exist_ok=True)

    prepared = []
    for source in manifest["sources"]:
        extension = Path(urllib.parse.urlparse(source["url"]).path).suffix.lower() or ".jpg"
        source_path = source_directory / f"{source['id']}{extension}"
        if not source_path.exists():
            print(f"Downloading {source['pageUrl']}…", flush=True)
            request = urllib.request.Request(
                source["url"], headers={"User-Agent": "RichiiVisionResearch/0.1"}
            )
            with urllib.request.urlopen(request) as response:
                source_path.write_bytes(response.read())
        digest = hashlib.sha256(source_path.read_bytes()).hexdigest()
        if digest != source["sha256"]:
            raise ValueError(f"SHA-256 mismatch for {source['id']}: {digest}")
        image = Image.open(source_path).convert("RGB")
        partition_directory = args.output / source["partition"]
        for index, item in enumerate(source["crops"]):
            label_directory = partition_directory / item["label"]
            label_directory.mkdir(parents=True, exist_ok=True)
            crop_path = label_directory / f"{source['id']}-{index:02d}.png"
            image.crop(tuple(item["box"])).save(crop_path)
            prepared.append(
                {
                    "crop": str(crop_path.relative_to(args.output)),
                    "label": item["label"],
                    "license": source["license"],
                    "pageUrl": source["pageUrl"],
                    "partition": source["partition"],
                    "sourceSha256": digest,
                }
            )
    (args.output / "prepared.json").write_text(
        json.dumps({"crops": prepared, "schemaVersion": 1}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Prepared {len(prepared)} verified crops in {args.output}", flush=True)


if __name__ == "__main__":
    main()
