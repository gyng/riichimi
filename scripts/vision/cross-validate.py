#!/usr/bin/env python3
"""Leave-one-source-out cross-validation over the real training photographs.

The recognizer is trained on two distributions at once — augmented CC0 vector
artwork and photographs of physical tiles — but it is *selected* on only the
first: `train-tile-classifier.py` keeps the epoch that scored best on a
synthetic validation set. That metric sits at 99.4% while real held-out accuracy
is 93.5%, so the checkpoint that ships is whichever epoch happened to fit vector
art best, chosen by a saturated signal from the wrong distribution.

Fixing that needs a real validation split, and the corpus appeared not to have
one: the 46 held-out crops are the thing being measured and must not be trained
against. But the *training* partition is three separate photographed tile sets,
so one can be held out at a time. Each fold trains on two families and validates
on the third, which is source-separated in exactly the way the release gate
requires, and rotating through them produces out-of-fold predictions for all 107
real crops — more than twice the resolution of the 46-crop set, without spending
any of it.

What this reports:

* the epoch synthetic validation would have chosen, and what it cost in real
  accuracy against the epoch a real fold would have chosen;
* out-of-fold accuracy and confidence over all 107 real training crops.

It writes a report in the same shape `evaluate-recognizer.py` consumes, so the
same intervals and calibration numbers apply to it.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch import nn
from torch.utils.data import DataLoader

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from tile_image import normalize_tile_face  # noqa: E402


def load_trainer():
    """Import the training module despite its hyphenated filename."""
    spec = importlib.util.spec_from_file_location("trainer", HERE / "train-tile-classifier.py")
    if spec is None or spec.loader is None:
        raise SystemExit("Could not load train-tile-classifier.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def source_of(path: Path) -> str:
    """Crops are written as `<sourceId>-<index>.png` by the preparation script."""
    return path.stem.rsplit("-", 1)[0]


def real_crops_by_source(crops: Path, classes: list[str]) -> dict[str, list[tuple[Path, int]]]:
    grouped: dict[str, list[tuple[Path, int]]] = defaultdict(list)
    for index, label in enumerate(classes):
        directory = crops / "train" / label
        if not directory.exists():
            continue
        for path in sorted(directory.glob("*.png")):
            grouped[source_of(path)].append((path, index))
    return dict(grouped)


def evaluation_tensor(paths: list[tuple[Path, int]]) -> tuple[torch.Tensor, torch.Tensor]:
    """The transform the shipped evaluator uses: normalize, scale, no augmentation."""
    pixels = np.stack(
        [
            np.asarray(normalize_tile_face(Image.open(path)), dtype=np.float32).transpose(2, 0, 1)
            / 127.5
            - 1
            for path, _ in paths
        ]
    )
    return torch.from_numpy(pixels), torch.tensor([index for _, index in paths])


def real_accuracy(model: nn.Module, images: torch.Tensor, targets: torch.Tensor) -> tuple[float, np.ndarray]:
    model.eval()
    with torch.no_grad():
        logits = model(images)
    probabilities = torch.softmax(logits, dim=1).numpy()
    correct = float((logits.argmax(dim=1) == targets).float().mean())
    return correct, probabilities


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets", required=True, type=Path, help="Regular SVG/PNG glyph directory")
    parser.add_argument("--real-crops", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--epochs", default=12, type=int)
    parser.add_argument("--samples-per-class", default=320, type=int)
    parser.add_argument("--validation-per-class", default=80, type=int)
    parser.add_argument("--real-samples-per-crop", default=24, type=int)
    parser.add_argument("--seed", default=20260802, type=int)
    args = parser.parse_args()

    trainer = load_trainer()
    classes: list[str] = list(trainer.CLASSES)
    torch.manual_seed(args.seed)
    torch.set_num_threads(min(16, torch.get_num_threads()))

    assets, unknown_assets = trainer.load_assets(args.assets)
    grouped = real_crops_by_source(args.real_crops, classes)
    sources = sorted(grouped)
    print(f"Real training sources: {', '.join(f'{s} ({len(grouped[s])})' for s in sources)}\n")

    print("Generating the synthetic training pool once…", flush=True)
    synthetic_images, synthetic_labels = trainer.generate(
        assets, unknown_assets, args.samples_per_class, args.seed
    )
    synthetic_validation = trainer.generate(
        assets, unknown_assets, args.validation_per_class, args.seed + 91_001
    )
    validation_loader = DataLoader(
        trainer.TileDataset(*synthetic_validation), batch_size=256, num_workers=0
    )

    folds = []
    out_of_fold = []
    for held_out in sources:
        print(f"\n=== fold: holding out {held_out} ({len(grouped[held_out])} crops) ===", flush=True)
        included = [item for source in sources if source != held_out for item in grouped[source]]
        real_images, real_labels = trainer.render_variants(
            included, args.real_samples_per_crop, args.seed + 177_013
        )
        images = np.concatenate((synthetic_images, real_images))
        labels = np.concatenate((synthetic_labels, real_labels))
        loader = DataLoader(
            trainer.TileDataset(images, labels), batch_size=128, shuffle=True, num_workers=0
        )

        fold_images, fold_targets = evaluation_tensor(grouped[held_out])
        model = trainer.TileClassifier()
        optimizer = torch.optim.AdamW(model.parameters(), lr=0.0018, weight_decay=0.0001)
        scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
        loss_function = nn.CrossEntropyLoss(label_smoothing=0.04)

        history = []
        best_synthetic = (-math.inf, -1, None)
        best_real = (-math.inf, -1, None)
        for epoch in range(args.epochs):
            model.train()
            for batch_images, batch_labels in loader:
                optimizer.zero_grad(set_to_none=True)
                loss_function(model(batch_images), batch_labels).backward()
                optimizer.step()
            scheduler.step()
            synthetic_accuracy, _ = trainer.accuracy(model, validation_loader, torch.device("cpu"))
            fold_accuracy, probabilities = real_accuracy(model, fold_images, fold_targets)
            history.append({"epoch": epoch + 1, "real": fold_accuracy, "synthetic": synthetic_accuracy})
            print(
                f"  epoch {epoch + 1:02d}: synthetic={synthetic_accuracy:.4f}  real={fold_accuracy:.4f}",
                flush=True,
            )
            if synthetic_accuracy > best_synthetic[0]:
                best_synthetic = (synthetic_accuracy, epoch + 1, probabilities)
            if fold_accuracy > best_real[0]:
                best_real = (fold_accuracy, epoch + 1, probabilities)

        chosen = history[best_synthetic[1] - 1]
        best = history[best_real[1] - 1]
        print(
            f"  synthetic picked epoch {best_synthetic[1]} (real {chosen['real']:.4f}); "
            f"the best real epoch was {best_real[1]} ({best['real']:.4f}) "
            f"— gap {best['real'] - chosen['real']:+.4f}"
        )
        folds.append(
            {
                "chosenByReal": {"epoch": best_real[1], "realAccuracy": best["real"]},
                "chosenBySynthetic": {
                    "epoch": best_synthetic[1],
                    "realAccuracy": chosen["real"],
                    "syntheticAccuracy": chosen["synthetic"],
                },
                "crops": len(grouped[held_out]),
                "heldOut": held_out,
                "history": history,
            }
        )
        # Out-of-fold predictions come from the checkpoint the shipped pipeline
        # would have chosen, so the aggregate describes what actually ships.
        probabilities = best_synthetic[2]
        for (path, index), row in zip(grouped[held_out], probabilities, strict=True):
            order = np.argsort(-row)[:3]
            out_of_fold.append(
                {
                    "confidence": float(row[order[0]]),
                    "correct": bool(int(order[0]) == index),
                    "expected": classes[index],
                    "prediction": classes[int(order[0])],
                    "sourceId": held_out,
                    "top3": [
                        {"confidence": float(row[i]), "label": classes[int(i)]} for i in order
                    ],
                    "topThreeCorrect": index in [int(i) for i in order],
                }
            )

    correct = sum(1 for s in out_of_fold if s["correct"])
    top_three = sum(1 for s in out_of_fold if s["topThreeCorrect"])
    cost = [f["chosenByReal"]["realAccuracy"] - f["chosenBySynthetic"]["realAccuracy"] for f in folds]
    report = {
        "folds": folds,
        "outOfFold": {
            "crops": len(out_of_fold),
            "meanConfidence": sum(s["confidence"] for s in out_of_fold) / len(out_of_fold),
            "top1Accuracy": correct / len(out_of_fold),
            "top3Accuracy": top_three / len(out_of_fold),
        },
        "samples": out_of_fold,
        "schemaVersion": 1,
        "selectionCost": {
            "meanRealAccuracyGiveUp": sum(cost) / len(cost),
            "note": (
                "How much real accuracy the synthetic-validation checkpoint rule gives up "
                "against an oracle that picked the best epoch on the real fold. An oracle is "
                "optimistic by construction; the number bounds the loss rather than predicting "
                "the gain."
            ),
            "perFold": cost,
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    summary = {key: value for key, value in report.items() if key != "samples"}
    print(f"\n{json.dumps(summary['outOfFold'], indent=2)}")
    print(json.dumps(summary["selectionCost"], indent=2))


if __name__ == "__main__":
    main()
