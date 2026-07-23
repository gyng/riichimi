"""Shared tile-crop normalization for training and evaluation."""

from __future__ import annotations

import numpy as np
from PIL import Image, ImageOps

WIDTH = 48
HEIGHT = 64


def normalize_tile_face(image: Image.Image) -> Image.Image:
    """Find the low-chroma light tile face and normalize it to the model input."""
    working = image.convert("RGB")
    working.thumbnail((384, 384), Image.Resampling.LANCZOS)
    pixels = np.asarray(working, dtype=np.int16)
    maximum = pixels.max(axis=2)
    minimum = pixels.min(axis=2)
    luminance = pixels.mean(axis=2)
    mask = (luminance >= 125) & ((maximum - minimum) <= 92)
    rows = np.flatnonzero(mask.mean(axis=1) >= 0.22)
    columns = np.flatnonzero(mask.mean(axis=0) >= 0.22)
    if len(rows) >= 8 and len(columns) >= 8:
        left = max(0, int(columns[0]) - 2)
        top = max(0, int(rows[0]) - 2)
        right = min(working.width, int(columns[-1]) + 3)
        bottom = min(working.height, int(rows[-1]) + 3)
        candidate = working.crop((left, top, right, bottom))
        ratio = candidate.width / candidate.height
        if 0.45 <= ratio <= 1.05:
            working = candidate
    working = ImageOps.autocontrast(working, cutoff=(0.5, 0.5))
    return working.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
