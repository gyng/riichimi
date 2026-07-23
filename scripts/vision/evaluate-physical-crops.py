#!/usr/bin/env python3
"""Evaluate an ONNX crop classifier on source-separated physical photographs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

from tile_image import normalize_tile_face


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--training-report", required=True, type=Path)
    parser.add_argument("--crops", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--confidence-threshold", default=0.75, type=float)
    args = parser.parse_args()

    classes = json.loads(args.training_report.read_text(encoding="utf-8"))["classes"]
    prepared = json.loads((args.crops / "prepared.json").read_text(encoding="utf-8"))["crops"]
    evaluation = [item for item in prepared if item["partition"] == "evaluation"]
    session = ort.InferenceSession(str(args.model), providers=["CPUExecutionProvider"])
    samples = []
    prepared_pixels = []
    for item in evaluation:
        image = normalize_tile_face(Image.open(args.crops / item["crop"]))
        prepared_pixels.append(np.asarray(image, dtype=np.float32).transpose(2, 0, 1) / 127.5 - 1)
    for start in range(0, len(evaluation), 15):
        items = evaluation[start : start + 15]
        batch = prepared_pixels[start : start + 15]
        padded = [*batch, *([batch[-1]] * (15 - len(batch)))]
        batch_logits = session.run(["logits"], {"pixels": np.stack(padded)})[0]
        for item, logits in zip(items, batch_logits, strict=False):
            probabilities = np.exp(logits - logits.max())
            probabilities /= probabilities.sum()
            order = np.argsort(-probabilities)[:3]
            prediction = classes[int(order[0])]
            confidence = float(probabilities[order[0]])
            samples.append(
                {
                    "accepted": confidence >= args.confidence_threshold,
                    "confidence": confidence,
                    "correct": prediction == item["label"],
                    "expected": item["label"],
                    "pageUrl": item["pageUrl"],
                    "prediction": prediction,
                    "top3": [
                        {"confidence": float(probabilities[index]), "label": classes[int(index)]}
                        for index in order
                    ],
                }
            )
    accepted = [sample for sample in samples if sample["accepted"]]
    correct = [sample for sample in samples if sample["correct"]]
    accepted_correct = [sample for sample in accepted if sample["correct"]]
    report = {
        "confidenceThreshold": args.confidence_threshold,
        "metrics": {
            "acceptedAccuracy": len(accepted_correct) / len(accepted) if accepted else 0,
            "acceptedCoverage": len(accepted) / len(samples),
            "evaluatedCrops": len(samples),
            "top1Accuracy": len(correct) / len(samples),
        },
        "samples": samples,
        "schemaVersion": 1,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    main()
