import type { TileRecognitionPort } from "@riichimi/vision";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { decode } from "jpeg-js";
import * as ort from "onnxruntime-react-native";
import { Image } from "react-native";

import modelAsset from "../../assets/models/tile-classifier-v1.onnx";
import type { PixelFrame } from "../features/recognition/guided-layout";
import { recognizePixelFrame } from "../features/recognition/recognize-pixel-frame";

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function bytesFromBase64(value: string): Uint8Array {
  const decoded = globalThis.atob(value);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function pixelFrame(uri: string): Promise<PixelFrame> {
  const result = await manipulateAsync(uri, [{ resize: { width: 960 } }], {
    base64: true,
    compress: 0.92,
    format: SaveFormat.JPEG,
  });
  if (result.base64 === undefined) {
    throw new Error("The selected photo could not be decoded on this device.");
  }
  const decoded = decode(bytesFromBase64(result.base64), {
    formatAsRGBA: true,
    maxMemoryUsageInMB: 256,
    maxResolutionInMP: 4,
    tolerantDecoding: true,
    useTArray: true,
  });
  return {
    data: new Uint8ClampedArray(
      decoded.data.buffer,
      decoded.data.byteOffset,
      decoded.data.byteLength,
    ),
    height: decoded.height,
    width: decoded.width,
  };
}

function classifierSession(): Promise<ort.InferenceSession> {
  sessionPromise ??= ort.InferenceSession.create(Image.resolveAssetSource(modelAsset).uri, {
    graphOptimizationLevel: "all",
  });
  return sessionPromise;
}

export const tileRecognition: TileRecognitionPort = {
  async recognize(frame) {
    const pixels = await pixelFrame(frame.uri);
    return recognizePixelFrame(
      pixels,
      async (tensor, dimensions) => {
        const session = await classifierSession();
        const output = await session.run({
          pixels: new ort.Tensor("float32", tensor, [...dimensions]),
        });
        const logits = output["logits"];
        if (logits === undefined || !(logits.data instanceof Float32Array)) {
          throw new Error("The tile classifier returned no logits.");
        }
        return logits.data;
      },
      frame.layout ?? "guided",
    );
  },
};
