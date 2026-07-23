import type { ImageFrame, TileRecognitionPort } from "@richii/vision";
import type { InferenceSession } from "onnxruntime-web";
import type * as OrtWebGlNamespace from "onnxruntime-web/webgl";

import modelAsset from "../../assets/models/tile-classifier-v1.onnx";
import { recognizePixelFrame } from "../features/recognition/recognize-pixel-frame";
import type { PixelFrame } from "../features/recognition/guided-layout";

type OrtWebGl = typeof OrtWebGlNamespace;

let runtimePromise: Promise<OrtWebGl> | null = null;
let sessionPromise: Promise<InferenceSession> | null = null;

function classifierRuntime(): Promise<OrtWebGl> {
  runtimePromise ??= import("onnxruntime-web/webgl");
  return runtimePromise;
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener(
      "error",
      () => reject(new Error("The selected photo could not be decoded.")),
      {
        once: true,
      },
    );
    image.src = uri;
  });
}

async function pixelFrame(frame: ImageFrame): Promise<PixelFrame> {
  const image = await loadImage(frame.uri);
  const scale = Math.min(1, 960 / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) {
    throw new Error("This browser cannot prepare camera pixels for offline recognition.");
  }
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  return { data: pixels.data, height, width };
}

async function classifierSession(): Promise<InferenceSession> {
  const ort = await classifierRuntime();
  const bundledModel: unknown = modelAsset;
  if (typeof bundledModel !== "string") {
    throw new Error("The offline tile model could not be resolved by this web build.");
  }
  sessionPromise ??= ort.InferenceSession.create(bundledModel, {
    executionProviders: ["webgl"],
    graphOptimizationLevel: "all",
  });
  return sessionPromise;
}

export const tileRecognition: TileRecognitionPort = {
  async recognize(frame) {
    const pixels = await pixelFrame(frame);
    return recognizePixelFrame(pixels, async (tensor, dimensions) => {
      const [ort, session] = await Promise.all([classifierRuntime(), classifierSession()]);
      const output = await session.run({
        pixels: new ort.Tensor("float32", tensor, [...dimensions]),
      });
      const logits = output["logits"];
      if (logits === undefined || !(logits.data instanceof Float32Array)) {
        throw new Error("The tile classifier returned no logits.");
      }
      return logits.data;
    });
  },
};
