#!/usr/bin/env python3
"""Build a guided-hand dogfood fixture from source-separated physical crops."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

HAND = ["1m", "2m", "3m", "4m", "5m", "6m", "7p", "8p", "9p", "2s", "3s", "4s", "5p", "5p"]
DORA = "9s"
SOURCE_PAGE = "https://commons.wikimedia.org/wiki/File:Mahjong_eg_JP_Kantou.jpg"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--crops", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    prepared = json.loads((args.crops / "prepared.json").read_text(encoding="utf-8"))["crops"]
    by_label = {
        item["label"]: args.crops / item["crop"]
        for item in prepared
        if item["pageUrl"] == SOURCE_PAGE
    }
    missing = sorted({*HAND, DORA} - by_label.keys())
    if missing:
        raise ValueError(f"Held-out fixture source is missing {missing}")

    canvas = Image.new("RGB", (1200, 500), (29, 70, 57))
    tile_size = (60, 82)

    def paste_tile(label: str, x: int, y: int) -> None:
        source = Image.open(by_label[label]).convert("RGB").resize(tile_size, Image.Resampling.LANCZOS)
        shadow = Image.new("RGBA", (72, 94), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle((7, 8, 67, 90), radius=4, fill=(0, 0, 0, 105))
        shadow = shadow.filter(ImageFilter.GaussianBlur(3))
        canvas.paste(shadow, (x - 6, y - 6), shadow)
        canvas.paste(source, (x, y))

    x = 60
    for index, label in enumerate(HAND):
        if index == 11:
            x += 20
        paste_tile(label, x, 145)
        x += tile_size[0] + 10
    paste_tile(DORA, 1020, 310)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.output, optimize=True)


if __name__ == "__main__":
    main()
