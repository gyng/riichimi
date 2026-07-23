#!/usr/bin/env python3
"""Train Riichimi's compact crop classifier from rights-clear tile artwork.

The dataset is generated deterministically in memory. It simulates physical tile bodies,
perspective, glare, shadows, focus, camera noise, occlusion, and varied table surfaces around
CC0 glyph artwork. The resulting model classifies an already-localized tile crop; locating the
guided row is deliberately a separate runtime concern.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import random
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
from torch import nn
from torch.utils.data import DataLoader, Dataset

from tile_image import HEIGHT, WIDTH, normalize_tile_face
CLASSES = [
    *[f"{rank}m" for rank in range(1, 10)],
    *[f"{rank}p" for rank in range(1, 10)],
    *[f"{rank}s" for rank in range(1, 10)],
    "east",
    "south",
    "west",
    "north",
    "white",
    "green",
    "red",
    "0m",
    "0p",
    "0s",
    "unknown",
]

ASSET_NAMES = {
    **{f"{rank}m": f"Man{rank}.png" for rank in range(1, 10)},
    **{f"{rank}p": f"Pin{rank}.png" for rank in range(1, 10)},
    **{f"{rank}s": f"Sou{rank}.png" for rank in range(1, 10)},
    "east": "Ton.png",
    "south": "Nan.png",
    "west": "Shaa.png",
    "north": "Pei.png",
    "white": "Haku.png",
    "green": "Hatsu.png",
    "red": "Chun.png",
    "0m": "Man5-Dora.png",
    "0p": "Pin5-Dora.png",
    "0s": "Sou5-Dora.png",
}


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--assets", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--epochs", default=12, type=int)
    parser.add_argument("--samples-per-class", default=320, type=int)
    parser.add_argument("--validation-per-class", default=80, type=int)
    parser.add_argument("--seed", default=20260723, type=int)
    parser.add_argument("--real-crops", type=Path)
    parser.add_argument("--real-samples-per-crop", default=80, type=int)
    return parser.parse_args()


def background(rng: random.Random) -> Image.Image:
    palettes = [
        ((19, 72, 58), (42, 111, 82)),
        ((49, 47, 42), (96, 88, 72)),
        ((74, 35, 23), (151, 83, 44)),
        ((25, 38, 59), (53, 82, 118)),
        ((122, 104, 78), (193, 168, 126)),
    ]
    start, end = rng.choice(palettes)
    direction = rng.random()
    x = np.linspace(0, 1, WIDTH, dtype=np.float32)[None, :, None]
    y = np.linspace(0, 1, HEIGHT, dtype=np.float32)[:, None, None]
    ratio = direction * x + (1 - direction) * y
    start_color = np.asarray(start, dtype=np.float32)[None, None, :]
    end_color = np.asarray(end, dtype=np.float32)[None, None, :]
    generator = np.random.default_rng(rng.randrange(2**32))
    noise = generator.normal(0, 6, (HEIGHT, WIDTH, 1))
    pixels = start_color * (1 - ratio) + end_color * ratio + noise
    return Image.fromarray(np.clip(pixels, 0, 255).astype(np.uint8), "RGB")


def perspective_tile(tile: Image.Image, rng: random.Random) -> Image.Image:
    scale = rng.uniform(0.78, 0.98)
    tile = tile.resize((round(WIDTH * scale), round(HEIGHT * scale)), Image.Resampling.LANCZOS)
    angle = rng.uniform(-10, 10)
    tile = tile.rotate(angle, Image.Resampling.BICUBIC, expand=True)
    shear = rng.uniform(-0.09, 0.09)
    return tile.transform(
        tile.size,
        Image.Transform.AFFINE,
        (1, shear, -shear * tile.height / 2, 0, 1, 0),
        Image.Resampling.BICUBIC,
    )


def render_known(glyph: Image.Image, rng: random.Random) -> Image.Image:
    canvas = background(rng).convert("RGBA")
    tile = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(tile)
    margin_x = rng.randint(2, 5)
    margin_y = rng.randint(2, 5)
    edge = rng.choice([(113, 176, 153, 255), (80, 139, 176, 255), (194, 157, 91, 255)])
    face_value = rng.randint(222, 252)
    shadow = Image.new("RGBA", tile.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (margin_x + 2, margin_y + 4, WIDTH - margin_x, HEIGHT - margin_y + 1),
        radius=rng.randint(3, 6),
        fill=(0, 0, 0, rng.randint(70, 145)),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(rng.uniform(1.0, 2.4)))
    tile.alpha_composite(shadow)
    draw.rounded_rectangle(
        (margin_x, margin_y + 3, WIDTH - margin_x - 1, HEIGHT - margin_y - 1),
        radius=rng.randint(3, 6),
        fill=edge,
    )
    draw.rounded_rectangle(
        (margin_x, margin_y, WIDTH - margin_x - 1, HEIGHT - margin_y - 5),
        radius=rng.randint(3, 6),
        fill=(face_value, min(255, face_value + 2), min(255, face_value + rng.randint(0, 7)), 255),
    )

    glyph_margin_x = margin_x + rng.randint(5, 8)
    glyph_margin_top = margin_y + rng.randint(6, 10)
    glyph_width = WIDTH - glyph_margin_x * 2
    glyph_height = HEIGHT - glyph_margin_top - margin_y - rng.randint(9, 13)
    source = glyph.copy()
    source.thumbnail((glyph_width, glyph_height), Image.Resampling.LANCZOS)
    if rng.random() < 0.35:
        source = source.filter(rng.choice([ImageFilter.MinFilter(3), ImageFilter.MaxFilter(3)]))
    glyph_x = (WIDTH - source.width) // 2 + rng.randint(-1, 1)
    glyph_y = glyph_margin_top + (glyph_height - source.height) // 2 + rng.randint(-1, 1)
    tile.alpha_composite(source, (glyph_x, glyph_y))

    if rng.random() < 0.65:
        glare = Image.new("RGBA", tile.size, (0, 0, 0, 0))
        glare_draw = ImageDraw.Draw(glare)
        x = rng.randint(4, WIDTH - 10)
        glare_draw.polygon(
            [(x, 1), (x + rng.randint(4, 10), 1), (x - 4, HEIGHT - 8), (x - 9, HEIGHT - 8)],
            fill=(255, 255, 255, rng.randint(12, 50)),
        )
        tile.alpha_composite(glare.filter(ImageFilter.GaussianBlur(2)))

    tile = perspective_tile(tile, rng)
    x = (WIDTH - tile.width) // 2 + rng.randint(-3, 3)
    y = (HEIGHT - tile.height) // 2 + rng.randint(-3, 3)
    canvas.alpha_composite(tile, (x, y))
    return camera_damage(canvas.convert("RGB"), rng)


def render_unknown(unknown_assets: list[Image.Image], rng: random.Random) -> Image.Image:
    image = background(rng).convert("RGBA")
    if rng.random() < 0.7:
        glyph = rng.choice(unknown_assets)
        fake_tile = render_known(glyph, rng).convert("RGBA")
        cover = Image.new("RGBA", fake_tile.size, (0, 0, 0, 0))
        ImageDraw.Draw(cover).rectangle(
            (rng.randint(0, WIDTH // 2), 0, rng.randint(WIDTH // 2, WIDTH), HEIGHT),
            fill=(*rng.choice([(35, 73, 61), (75, 56, 42), (25, 45, 80)]), rng.randint(180, 255)),
        )
        image = Image.alpha_composite(fake_tile, cover)
    else:
        draw = ImageDraw.Draw(image)
        for _ in range(rng.randint(2, 9)):
            x = rng.randint(-10, WIDTH)
            y = rng.randint(-10, HEIGHT)
            draw.ellipse(
                (x, y, x + rng.randint(4, 30), y + rng.randint(4, 30)),
                fill=(*rng.choice([(232, 210, 174), (70, 120, 95), (160, 64, 45)]), 255),
            )
    return camera_damage(image.convert("RGB"), rng)


def render_real(crop: Image.Image, rng: random.Random) -> Image.Image:
    width, height = crop.size
    trim_x = round(width * rng.uniform(0, 0.045))
    trim_y = round(height * rng.uniform(0, 0.045))
    image = crop.crop((trim_x, trim_y, width - trim_x, height - trim_y)).convert("RGB")
    image = image.rotate(rng.uniform(-7, 7), Image.Resampling.BICUBIC, expand=False)
    return camera_damage(normalize_tile_face(image), rng)


def camera_damage(image: Image.Image, rng: random.Random) -> Image.Image:
    image = ImageEnhance.Brightness(image).enhance(rng.uniform(0.68, 1.26))
    image = ImageEnhance.Contrast(image).enhance(rng.uniform(0.72, 1.3))
    image = ImageEnhance.Color(image).enhance(rng.uniform(0.65, 1.35))
    if rng.random() < 0.45:
        image = image.filter(ImageFilter.GaussianBlur(rng.uniform(0.15, 1.25)))
    array = np.asarray(image, dtype=np.float32)
    noise = np.random.default_rng(rng.randrange(2**32)).normal(0, rng.uniform(0, 9), array.shape)
    image = Image.fromarray(np.clip(array + noise, 0, 255).astype(np.uint8), "RGB")
    if rng.random() < 0.35:
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=rng.randint(42, 92))
        image = Image.open(io.BytesIO(buffer.getvalue())).convert("RGB")
    return normalize_tile_face(image)


def load_assets(path: Path) -> tuple[dict[str, Image.Image], list[Image.Image]]:
    def prepared(name: str) -> Image.Image:
        image = Image.open(path / name).convert("RGBA")
        image.thumbnail((36, 48), Image.Resampling.LANCZOS)
        return image

    known = {label: prepared(filename) for label, filename in ASSET_NAMES.items()}
    unknown = [prepared(name) for name in ["Back.png", "Blank.png", "Front.png"]]
    missing = [label for label in CLASSES[:-1] if label not in known]
    if missing:
        raise ValueError(f"Missing assets for {missing}")
    return known, unknown


def generate(
    assets: dict[str, Image.Image],
    unknown_assets: list[Image.Image],
    per_class: int,
    seed: int,
) -> tuple[np.ndarray, np.ndarray]:
    images = np.empty((len(CLASSES) * per_class, HEIGHT, WIDTH, 3), dtype=np.uint8)
    labels = np.empty(len(CLASSES) * per_class, dtype=np.int64)
    for class_index, label in enumerate(CLASSES):
        for sample_index in range(per_class):
            rng = random.Random(seed + class_index * 1_000_003 + sample_index * 7_919)
            image = (
                render_unknown(unknown_assets, rng)
                if label == "unknown"
                else render_known(assets[label], rng)
            )
            offset = class_index * per_class + sample_index
            images[offset] = np.asarray(image)
            labels[offset] = class_index
    order = np.random.default_rng(seed).permutation(len(labels))
    return images[order], labels[order]


def generate_real(crops_path: Path, per_crop: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    samples: list[tuple[Path, int]] = []
    for class_index, label in enumerate(CLASSES):
        label_path = crops_path / "train" / label
        if label_path.exists():
            samples.extend((path, class_index) for path in sorted(label_path.glob("*.png")))
    images = np.empty((len(samples) * per_crop, HEIGHT, WIDTH, 3), dtype=np.uint8)
    labels = np.empty(len(samples) * per_crop, dtype=np.int64)
    offset = 0
    for crop_index, (path, class_index) in enumerate(samples):
        crop = Image.open(path).convert("RGB")
        for sample_index in range(per_crop):
            rng = random.Random(seed + crop_index * 1_000_003 + sample_index * 7_919)
            images[offset] = np.asarray(render_real(crop, rng))
            labels[offset] = class_index
            offset += 1
    order = np.random.default_rng(seed).permutation(len(labels))
    return images[order], labels[order]


def physical_training_sources(crops_path: Path) -> list[dict[str, str]]:
    prepared = json.loads((crops_path / "prepared.json").read_text(encoding="utf-8"))["crops"]
    sources = {
        (item["pageUrl"], item["sourceSha256"]): {
            "license": item["license"],
            "pageUrl": item["pageUrl"],
            "sha256": item["sourceSha256"],
        }
        for item in prepared
        if item["partition"] == "train"
    }
    return [sources[key] for key in sorted(sources)]


class TileDataset(Dataset[tuple[torch.Tensor, torch.Tensor]]):
    def __init__(self, images: np.ndarray, labels: np.ndarray):
        self.images = images
        self.labels = labels

    def __len__(self) -> int:
        return len(self.labels)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, torch.Tensor]:
        pixels = torch.from_numpy(self.images[index].copy()).permute(2, 0, 1).float().div_(255)
        pixels = pixels.sub_(0.5).div_(0.5)
        return pixels, torch.tensor(self.labels[index], dtype=torch.long)


class TileClassifier(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 24, 3, padding=1, bias=False),
            nn.BatchNorm2d(24),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(24, 48, 3, padding=1, bias=False),
            nn.BatchNorm2d(48),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(48, 96, 3, padding=1, bias=False),
            nn.BatchNorm2d(96),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2),
            nn.Conv2d(96, 128, 3, padding=1, bias=False),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.AdaptiveAvgPool2d((4, 3)),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Dropout(0.2),
            nn.Linear(128 * 4 * 3, 192),
            nn.ReLU(inplace=True),
            nn.Dropout(0.2),
            nn.Linear(192, len(CLASSES)),
        )

    def forward(self, pixels: torch.Tensor) -> torch.Tensor:
        return self.classifier(self.features(pixels))


def accuracy(model: nn.Module, loader: DataLoader, device: torch.device) -> tuple[float, list[float]]:
    correct = np.zeros(len(CLASSES), dtype=np.int64)
    total = np.zeros(len(CLASSES), dtype=np.int64)
    model.eval()
    with torch.inference_mode():
        for images, labels in loader:
            predictions = model(images.to(device)).argmax(dim=1).cpu()
            for expected, predicted in zip(labels, predictions, strict=True):
                class_index = int(expected)
                total[class_index] += 1
                correct[class_index] += int(expected == predicted)
    per_class = [float(value / count) for value, count in zip(correct, total, strict=True)]
    return float(correct.sum() / total.sum()), per_class


def main() -> None:
    args = arguments()
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.set_num_threads(min(16, torch.get_num_threads()))

    assets, unknown_assets = load_assets(args.assets)
    print("Generating deterministic train set…", flush=True)
    train_images, train_labels = generate(
        assets, unknown_assets, args.samples_per_class, args.seed
    )
    real_training_crops = 0
    if args.real_crops is not None:
        print("Generating licensed physical-photo training variants…", flush=True)
        real_images, real_labels = generate_real(
            args.real_crops, args.real_samples_per_crop, args.seed + 177_013
        )
        real_training_crops = len(real_labels) // args.real_samples_per_crop
        train_images = np.concatenate((train_images, real_images))
        train_labels = np.concatenate((train_labels, real_labels))
    print("Generating independent synthetic validation set…", flush=True)
    validation_images, validation_labels = generate(
        assets, unknown_assets, args.validation_per_class, args.seed + 91_001
    )
    train_loader = DataLoader(
        TileDataset(train_images, train_labels), batch_size=128, shuffle=True, num_workers=0
    )
    validation_loader = DataLoader(
        TileDataset(validation_images, validation_labels), batch_size=256, num_workers=0
    )

    device = torch.device("cpu")
    model = TileClassifier().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.0018, weight_decay=0.0001)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    loss_function = nn.CrossEntropyLoss(label_smoothing=0.04)
    best_accuracy = -math.inf
    best_state: dict[str, torch.Tensor] | None = None

    for epoch in range(args.epochs):
        model.train()
        running_loss = 0.0
        for images, labels in train_loader:
            optimizer.zero_grad(set_to_none=True)
            loss = loss_function(model(images.to(device)), labels.to(device))
            loss.backward()
            optimizer.step()
            running_loss += float(loss.detach())
        scheduler.step()
        validation_accuracy, _ = accuracy(model, validation_loader, device)
        print(
            f"epoch {epoch + 1:02d}/{args.epochs}: "
            f"loss={running_loss / len(train_loader):.4f} "
            f"synthetic_top1={validation_accuracy:.4f}",
            flush=True,
        )
        if validation_accuracy > best_accuracy:
            best_accuracy = validation_accuracy
            best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}

    if best_state is None:
        raise RuntimeError("Training produced no checkpoint")
    model.load_state_dict(best_state)
    validation_accuracy, per_class = accuracy(model, validation_loader, device)
    model.eval()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Guided recognition always supplies 14 hand tiles plus one dora indicator. A fixed
    # batch keeps ONNX Runtime Web's WebGL shape validation portable across browsers.
    sample = torch.zeros((15, 3, HEIGHT, WIDTH), dtype=torch.float32)
    torch.onnx.export(
        model,
        (sample,),
        args.output,
        input_names=["pixels"],
        output_names=["logits"],
        dynamo=False,
        opset_version=18,
    )
    onnx.checker.check_model(onnx.load(args.output))
    session = ort.InferenceSession(str(args.output), providers=["CPUExecutionProvider"])
    torch_logits = model(sample).detach().numpy()
    onnx_logits = session.run(["logits"], {"pixels": sample.numpy()})[0]
    maximum_export_delta = float(np.max(np.abs(torch_logits - onnx_logits)))
    if maximum_export_delta > 1e-4:
        raise RuntimeError(f"ONNX parity delta {maximum_export_delta} exceeded 1e-4")

    digest = hashlib.sha256(args.output.read_bytes()).hexdigest()
    training_sources = (
        physical_training_sources(args.real_crops) if args.real_crops is not None else []
    )
    artifact_license = (
        "CC-BY-SA-4.0"
        if any(source["license"] == "CC-BY-SA-4.0" for source in training_sources)
        else "CC-BY-SA-3.0"
    )
    report = {
        "artifact": {
            "bytes": args.output.stat().st_size,
            "license": artifact_license,
            "path": str(args.output),
            "provenance": "scripts/vision/physical-photo-crops.json",
            "sha256": digest,
        },
        "classes": CLASSES,
        "input": {
            "batch": 15,
            "colorSpace": "rgb",
            "height": HEIGHT,
            "layout": "nchw",
            "width": WIDTH,
        },
        "metrics": {
            "perClassSyntheticTop1Accuracy": dict(zip(CLASSES, per_class, strict=True)),
            "syntheticSamples": len(validation_labels),
            "syntheticTop1Accuracy": validation_accuracy,
        },
        "onnxParityMaximumAbsoluteDelta": maximum_export_delta,
        "seed": args.seed,
        "source": {
            "assetCommit": "26e127ba2117f45cdce5ea0225748cc0cfad3169",
            "assetLicense": "CC0-1.0",
            "assetUrl": "https://github.com/FluffyStuff/riichi-mahjong-tiles",
            "physicalTraining": training_sources,
        },
        "training": {
            "epochs": args.epochs,
            "physicalPhotoCrops": real_training_crops,
            "physicalVariantsPerCrop": args.real_samples_per_crop if real_training_crops > 0 else 0,
            "samplesPerClass": args.samples_per_class,
            "validationPerClass": args.validation_per_class,
        },
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    main()
