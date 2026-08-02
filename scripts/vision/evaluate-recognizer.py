#!/usr/bin/env python3
"""Measure a tile classifier well enough to decide whether a change is real.

`evaluate-physical-crops.py` answers "how often is it right". That is not the
question a review-gated scanner needs answered. This reports the axes that
decide whether a change ships:

* whether the model knows when it is wrong (calibration, confident-wrong rate)
* what a person has to do about it (correction burden per hand)
* where it fails (per class, per photographed tile set)
* whether the held-out set can resolve the change at all (Wilson intervals)

That last one is the point. The set is 46 crops. A one-crop move is 2.2
percentage points, so two models can differ by several points and be the same
model. Every rate here carries a 95% Wilson interval, and `--baseline` states
plainly whether a difference survives them.
"""

from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

from tile_image import HEIGHT, WIDTH, normalize_tile_face

BATCH = 15  # The exported model takes one guided hand: 14 tiles plus a dora.
UNKNOWN = "unknown"


def wilson_interval(successes: int, total: int, z: float = 1.96) -> tuple[float, float]:
    """95% Wilson score interval, which stays sane at small n and at p near 0 or 1."""
    if total == 0:
        return (0.0, 0.0)
    proportion = successes / total
    denominator = 1 + z * z / total
    center = (proportion + z * z / (2 * total)) / denominator
    margin = (
        z
        * math.sqrt(proportion * (1 - proportion) / total + z * z / (4 * total * total))
        / denominator
    )
    return (max(0.0, center - margin), min(1.0, center + margin))


def rate(successes: int, total: int) -> dict:
    low, high = wilson_interval(successes, total)
    return {
        "count": successes,
        "interval95": [low, high],
        "total": total,
        "value": successes / total if total else 0.0,
    }


def augmentations(image: Image.Image, count: int) -> list[Image.Image]:
    """Scale/translate jitter around the normalized face.

    No flips or rotations. A mirrored tile face is a different glyph — several
    souzu and the honours are not symmetric — so a flip would average over a
    class boundary rather than over nuisance variation.
    """
    if count <= 1:
        return [image]
    views = [image]
    # Zoom slightly into each corner and the centre: the localizer's box is the
    # dominant nuisance, so vary what it might have cut off.
    insets = [(2, 2), (0, 0), (4, 4), (2, 0), (0, 2), (4, 2), (2, 4), (4, 0), (0, 4)]
    for inset_x, inset_y in insets[: count - 1]:
        box = (inset_x, inset_y, WIDTH - inset_x, HEIGHT - inset_y)
        views.append(image.crop(box).resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS))
    return views


def to_tensor(image: Image.Image) -> np.ndarray:
    return np.asarray(image, dtype=np.float32).transpose(2, 0, 1) / 127.5 - 1


def softmax(logits: np.ndarray, temperature: float) -> np.ndarray:
    scaled = logits / temperature
    shifted = np.exp(scaled - scaled.max())
    return shifted / shifted.sum()


def raw_logits(session: ort.InferenceSession, tensors: list[np.ndarray]) -> np.ndarray:
    """One row of logits per crop, single view, untouched by temperature."""
    rows: list[np.ndarray] = []
    for start in range(0, len(tensors), BATCH):
        window = tensors[start : start + BATCH]
        padded = [*window, *([window[-1]] * (BATCH - len(window)))]
        rows.extend(session.run(["logits"], {"pixels": np.stack(padded)})[0][: len(window)])
    return np.stack(rows)


def predict(
    session: ort.InferenceSession,
    tensors: list[np.ndarray],
    views: int,
    temperature: float,
) -> list[np.ndarray]:
    """Run every view of every crop and average the per-view probabilities.

    Averaging probabilities rather than logits keeps each view's own confidence
    meaningful; averaging logits lets one over-confident view dominate.
    """
    flat = [tensor for group in tensors for tensor in group]
    probabilities: list[np.ndarray] = []
    for start in range(0, len(flat), BATCH):
        window = flat[start : start + BATCH]
        padded = [*window, *([window[-1]] * (BATCH - len(window)))]
        logits = session.run(["logits"], {"pixels": np.stack(padded)})[0]
        probabilities.extend(softmax(row, temperature) for row in logits[: len(window)])
    return [
        np.mean(probabilities[index * views : (index + 1) * views], axis=0)
        for index in range(len(tensors))
    ]


TEMPERATURE_SCAN = (0.05, 6.0, 0.01)


def fit_temperature(logits: np.ndarray, targets: np.ndarray) -> tuple[float, dict]:
    """Pick the temperature that minimizes negative log-likelihood on a held-in split.

    A scan rather than a gradient step: the objective is one dimensional and the
    grid is finer than the difference any downstream metric can resolve, so
    there is no optimizer to misconfigure.

    The scan also reports whether the fit degenerated. If the split is separable
    — the model is perfect on it — NLL falls monotonically as the temperature
    approaches zero and the "best" temperature is just the edge of the grid.
    That is not a calibration; it is a split that cannot calibrate.
    """
    low, high, step = TEMPERATURE_SCAN
    best, best_loss = 1.0, math.inf
    for candidate in np.arange(low, high + step, step):
        scaled = logits / candidate
        scaled -= scaled.max(axis=1, keepdims=True)
        loss = float(
            np.mean(np.log(np.exp(scaled).sum(axis=1)) - scaled[np.arange(len(targets)), targets])
        )
        if loss < best_loss:
            best, best_loss = float(candidate), loss
    accuracy = float((logits.argmax(axis=1) == targets).mean())
    return best, {
        "accuracyOnFitSplit": accuracy,
        "degenerate": best <= low + step or accuracy >= 1.0,
        "negativeLogLikelihood": best_loss,
        "scan": {"maximum": high, "minimum": low, "step": step},
    }


def calibration(samples: list[dict], bins: int) -> dict:
    """Expected and maximum calibration error over equal-width confidence bins.

    ECE is the mean gap between what the model claims and what it delivers,
    weighted by how many reads land in each bin. A review gate reads confidence
    as a promise; ECE says how much that promise is worth.
    """
    edges = np.linspace(0.0, 1.0, bins + 1)
    reliability = []
    expected = 0.0
    maximum = 0.0
    for index in range(bins):
        low, high = float(edges[index]), float(edges[index + 1])
        in_bin = [
            sample
            for sample in samples
            if sample["confidence"] > low and (sample["confidence"] <= high or index == bins - 1)
        ]
        if not in_bin:
            continue
        accuracy = sum(1 for sample in in_bin if sample["correct"]) / len(in_bin)
        confidence = sum(sample["confidence"] for sample in in_bin) / len(in_bin)
        gap = abs(accuracy - confidence)
        expected += gap * len(in_bin) / len(samples)
        maximum = max(maximum, gap)
        reliability.append(
            {
                "accuracy": accuracy,
                "count": len(in_bin),
                "gap": gap,
                "lowerBound": low,
                "meanConfidence": confidence,
                "upperBound": high,
            }
        )
    return {
        "expectedCalibrationError": expected,
        "maximumCalibrationError": maximum,
        "overconfident": sum(
            entry["count"] for entry in reliability if entry["meanConfidence"] > entry["accuracy"]
        ),
        "reliability": reliability,
    }


def slice_metrics(samples: list[dict], key: str, minimum_support: int) -> list[dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for sample in samples:
        grouped[sample[key]].append(sample)
    rows = []
    for name, group in sorted(grouped.items()):
        correct = sum(1 for sample in group if sample["correct"])
        rows.append(
            {
                "accuracy": rate(correct, len(group)),
                "meanConfidence": sum(sample["confidence"] for sample in group) / len(group),
                "name": name,
                # Below this, a single crop moves the number by more than any
                # plausible model change. The field exists so a reader does not
                # read 100% off one sample as evidence.
                "resolvable": len(group) >= minimum_support,
                "support": len(group),
            }
        )
    return rows


def operating_point(samples: list[dict], threshold: float, hand_size: int) -> dict:
    """What the gate costs and what it lets through, at one confidence threshold.

    `confidentWrong` is the number that matters most: a read the gate accepted
    and got wrong is a silent error a person is never prompted to look at.
    """
    accepted = [sample for sample in samples if sample["confidence"] >= threshold]
    accepted_correct = sum(1 for sample in accepted if sample["correct"])
    reviewed = len(samples) - len(accepted)
    confident_wrong = len(accepted) - accepted_correct
    return {
        "acceptedAccuracy": rate(accepted_correct, len(accepted)),
        "acceptedCoverage": rate(len(accepted), len(samples)),
        "confidentWrong": rate(confident_wrong, len(samples)),
        "correctionBurden": {
            # What a person actually does per scanned hand: confirm or fix every
            # read the gate held back.
            "reviewedPerHand": reviewed / len(samples) * hand_size if samples else 0.0,
            "silentErrorsPerHand": confident_wrong / len(samples) * hand_size if samples else 0.0,
            "handsWithNoReview": (1 - reviewed / len(samples)) ** hand_size if samples else 0.0,
        },
        "threshold": threshold,
    }


def compare(current: dict, baseline: dict) -> dict:
    """State whether a difference survives the intervals, rather than implying it does."""
    findings = []
    for path in ("top1Accuracy", "operatingPoint.acceptedCoverage", "operatingPoint.confidentWrong"):
        node_current, node_baseline = current, baseline
        for part in path.split("."):
            node_current = node_current[part]
            node_baseline = node_baseline[part]
        low_current, high_current = node_current["interval95"]
        low_baseline, high_baseline = node_baseline["interval95"]
        overlap = low_current <= high_baseline and low_baseline <= high_current
        findings.append(
            {
                "baseline": node_baseline["value"],
                "current": node_current["value"],
                "delta": node_current["value"] - node_baseline["value"],
                "metric": path,
                # Overlapping 95% intervals on this few crops means the set
                # cannot tell the two models apart. It is not evidence of
                # equivalence, only absence of evidence of difference.
                "separated": not overlap,
            }
        )
    return {
        "metrics": findings,
        "verdict": (
            "separated"
            if any(finding["separated"] for finding in findings)
            else "within-noise: the held-out set cannot resolve this change"
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--training-report", required=True, type=Path)
    parser.add_argument("--crops", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--partition", default="evaluation")
    parser.add_argument("--confidence-threshold", default=0.75, type=float)
    parser.add_argument("--calibration-bins", default=10, type=int)
    parser.add_argument("--minimum-support", default=3, type=int)
    parser.add_argument("--hand-size", default=BATCH, type=int)
    parser.add_argument(
        "--tta-views",
        default=1,
        type=int,
        help="Averaged crop views per tile; 1 disables test-time augmentation.",
    )
    parser.add_argument(
        "--temperature",
        default=1.0,
        type=float,
        help="Softmax temperature; >1 softens confidence, <1 sharpens it.",
    )
    parser.add_argument(
        "--fit-temperature-on",
        help=(
            "Partition to fit the temperature on by minimizing NLL. Overrides "
            "--temperature. Never pass the partition being reported: choosing a "
            "temperature on the set it is scored against is fitting to the test."
        ),
    )
    parser.add_argument(
        "--allow-degenerate-temperature",
        action="store_true",
        help="Record a temperature fit that ran to the edge of the scan, as a diagnostic.",
    )
    parser.add_argument("--baseline", type=Path, help="An earlier report to compare against.")
    args = parser.parse_args()

    classes = json.loads(args.training_report.read_text(encoding="utf-8"))["classes"]
    prepared = json.loads((args.crops / "prepared.json").read_text(encoding="utf-8"))["crops"]
    evaluation = [item for item in prepared if item["partition"] == args.partition]
    if not evaluation:
        raise SystemExit(f"No crops in partition {args.partition!r}")

    session = ort.InferenceSession(str(args.model), providers=["CPUExecutionProvider"])

    temperature = args.temperature
    fitted_on = None
    if args.fit_temperature_on is not None:
        if args.fit_temperature_on == args.partition:
            raise SystemExit(
                "Refusing to fit the temperature on the partition being reported: "
                "that measures the fit, not the model."
            )
        fit_items = [item for item in prepared if item["partition"] == args.fit_temperature_on]
        if not fit_items:
            raise SystemExit(f"No crops in partition {args.fit_temperature_on!r}")
        fit_tensors = [
            to_tensor(normalize_tile_face(Image.open(args.crops / item["crop"])))
            for item in fit_items
        ]
        targets = np.array([classes.index(item["label"]) for item in fit_items])
        temperature, diagnostics = fit_temperature(raw_logits(session, fit_tensors), targets)
        fitted_on = {
            "crops": len(fit_items),
            "partition": args.fit_temperature_on,
            **diagnostics,
        }
        if diagnostics["degenerate"] and not args.allow_degenerate_temperature:
            raise SystemExit(
                f"Temperature fit on {args.fit_temperature_on!r} degenerated to "
                f"T={temperature:.2f} at {diagnostics['accuracyOnFitSplit']:.1%} accuracy. "
                "The model separates that split perfectly, so likelihood keeps improving "
                "as confidence sharpens and the fit runs to the edge of the scan. "
                "Calibration needs a split the model gets wrong sometimes and is not "
                "scored on: a third, source-separated validation partition. "
                "Pass --allow-degenerate-temperature to record the number anyway."
            )

    tensors = []
    for item in evaluation:
        face = normalize_tile_face(Image.open(args.crops / item["crop"]))
        tensors.append([to_tensor(view) for view in augmentations(face, args.tta_views)])
    views = len(tensors[0])
    distributions = predict(session, tensors, views, temperature)

    samples = []
    for item, probabilities in zip(evaluation, distributions, strict=True):
        order = np.argsort(-probabilities)[:3]
        prediction = classes[int(order[0])]
        samples.append(
            {
                "confidence": float(probabilities[order[0]]),
                "correct": prediction == item["label"],
                "expected": item["label"],
                "prediction": prediction,
                # `sourceId` is the tile set in the photograph. Older prepared.json
                # files predate it; fall back so an old corpus still reports.
                "sourceId": item.get("sourceId", "unknown-source"),
                "top3": [
                    {"confidence": float(probabilities[index]), "label": classes[int(index)]}
                    for index in order
                ],
                "topThreeCorrect": item["label"]
                in [classes[int(index)] for index in order],
            }
        )

    correct = sum(1 for sample in samples if sample["correct"])
    top_three = sum(1 for sample in samples if sample["topThreeCorrect"])
    predicted_unknown = sum(1 for sample in samples if sample["prediction"] == UNKNOWN)

    report = {
        "calibration": calibration(samples, args.calibration_bins),
        "configuration": {
            "calibrationBins": args.calibration_bins,
            "handSize": args.hand_size,
            "minimumSupport": args.minimum_support,
            "model": str(args.model),
            "partition": args.partition,
            "temperature": temperature,
            "temperatureFittedOn": fitted_on,
            "ttaViews": views,
        },
        "operatingPoint": operating_point(samples, args.confidence_threshold, args.hand_size),
        "perClass": slice_metrics(samples, "expected", args.minimum_support),
        "perTileSet": slice_metrics(samples, "sourceId", args.minimum_support),
        "resolution": {
            "evaluatedCrops": len(samples),
            # The honest floor: one crop is the smallest possible move.
            "smallestDistinguishableChange": 1 / len(samples),
            "unresolvableClasses": sum(
                1
                for row in slice_metrics(samples, "expected", args.minimum_support)
                if not row["resolvable"]
            ),
        },
        "samples": samples,
        "schemaVersion": 2,
        "thresholdSweep": [
            operating_point(samples, threshold / 100, args.hand_size)
            for threshold in range(50, 100, 5)
        ],
        "top1Accuracy": rate(correct, len(samples)),
        "top3Accuracy": rate(top_three, len(samples)),
        "unknown": {
            # The corpus is all real tiles, so this counts false unknowns only:
            # a read the model refused that a person then has to supply.
            "falseUnknownRate": rate(predicted_unknown, len(samples)),
            "recallMeasurable": False,
            "why": (
                "Unknown recall needs hard negatives — sticks, dice, racks, fingers, "
                "patterned tables. Every crop in this corpus is a real tile face, so "
                "the corpus can only measure false unknowns, never missed ones."
            ),
        },
    }

    if args.baseline is not None:
        report["comparison"] = compare(
            report, json.loads(args.baseline.read_text(encoding="utf-8"))
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    summary = {key: value for key, value in report.items() if key != "samples"}
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
