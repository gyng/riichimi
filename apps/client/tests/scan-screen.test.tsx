import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";

import { ScanScreen } from "../src/screens/scan-screen";
import { tileRecognition } from "../src/infrastructure/tile-recognition";

vi.mock("expo-router", () => ({
  router: {
    back: vi.fn<typeof router.back>(),
    push: vi.fn<typeof router.push>(),
    replace: vi.fn<typeof router.replace>(),
  },
}));

vi.mock("expo-camera", () => ({
  CameraView: "CameraView",
  useCameraPermissions: () => [
    { canAskAgain: false, granted: false, status: "denied" },
    vi.fn<() => Promise<void>>(),
  ],
}));

vi.mock("expo-image-picker", () => ({
  getPendingResultAsync: vi.fn<typeof ImagePicker.getPendingResultAsync>().mockResolvedValue(null),
  launchImageLibraryAsync: vi
    .fn<typeof ImagePicker.launchImageLibraryAsync>()
    .mockResolvedValue({ assets: null, canceled: true }),
}));

vi.mock("../src/infrastructure/tile-recognition", () => ({
  tileRecognition: { recognize: vi.fn<typeof tileRecognition.recognize>() },
}));

// jsdom never decodes an image, so the off-screen probe the screen uses to learn
// a photo's shape would never fire. Report a size to it so the photo aspect —
// and the detection-box overlay it positions — can be measured in tests.
beforeEach(() => {
  Object.defineProperty(window.Image.prototype, "naturalWidth", { configurable: true, value: 300 });
  Object.defineProperty(window.Image.prototype, "naturalHeight", {
    configurable: true,
    value: 150,
  });
  Object.defineProperty(window.Image.prototype, "src", {
    configurable: true,
    set() {
      this.dispatchEvent(new Event("load"));
    },
  });
});

describe("ScanScreen", () => {
  it("keeps the calculator usable when camera access is unavailable", async () => {
    render(<ScanScreen />);

    expect(screen.getByRole("button", { name: "Camera access is blocked" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Enter tiles manually" }));

    expect(router.replace).toHaveBeenCalledWith("/manual");
  });

  it("loads a bundled sample hand so the flow works without a camera", async () => {
    render(<ScanScreen />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try a sample hand" }));
    });

    expect(await screen.findByText("Photo ready for review")).toBeInTheDocument();
  });

  it("opens an existing photo and carries it into manual correction", async () => {
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
      assets: [
        {
          assetId: null,
          base64: null,
          duration: null,
          exif: null,
          fileName: "hand.jpg",
          fileSize: 42,
          height: 600,
          mimeType: "image/jpeg",
          type: "image",
          uri: "file:///hand.jpg",
          width: 1200,
        },
      ],
      canceled: false,
    });
    render(<ScanScreen />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Choose an existing photo" }));
    });
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Photo ready for review")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enter tiles from this photo" }));

    expect(router.push).toHaveBeenCalledWith({
      params: { referencePhoto: "file:///hand.jpg" },
      pathname: "/manual",
    });
  });

  it("recognizes a guided photo and opens a reviewable calculator draft", async () => {
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
      assets: [
        {
          assetId: null,
          base64: null,
          duration: null,
          exif: null,
          fileName: "guided-hand.jpg",
          fileSize: 42,
          height: 600,
          mimeType: "image/jpeg",
          type: "image",
          uri: "file:///guided-hand.jpg",
          width: 1200,
        },
      ],
      canceled: false,
    });
    const handTiles = [
      "1m",
      "1m",
      "1m",
      "2m",
      "2m",
      "2m",
      "3m",
      "3m",
      "3m",
      "4p",
      "4p",
      "4p",
      "east",
      "east",
    ] as const;
    vi.mocked(tileRecognition).recognize.mockResolvedValueOnce({
      detections: [
        ...handTiles.map((tile, index) => ({
          alternatives: [{ confidence: 0.8, tile }],
          bounds: { height: 0.3, width: 0.05, x: index / 20, y: 0.2 },
          confidence: index === 4 ? 0.6 : 0.9,
          id: `hand-${index}`,
          role: index === 13 ? ("winning" as const) : ("concealed" as const),
          tile,
        })),
        {
          alternatives: [{ confidence: 0.9, tile: "9s" as const }],
          bounds: { height: 0.3, width: 0.05, x: 0.8, y: 0.65 },
          confidence: 0.9,
          id: "dora-0",
          role: "dora" as const,
          tile: "9s" as const,
        },
      ],
      modelVersion: "guided-crop-v0-test",
    });
    render(<ScanScreen />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Choose an existing photo" }));
    });
    // Reading starts on its own once a photo exists; no extra tap to begin.
    expect(await screen.findByText("15 tiles read · 1 need review")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve 1 tile to continue" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Use 2 characters for selected tile" }));
    expect(await screen.findByText("Recognition review complete")).toBeInTheDocument();
    // The natural (default) layout still confirms the concealed/called split, but
    // the confirmation is the continue action itself rather than an extra tap.
    fireEvent.click(screen.getByRole("button", { name: "Confirm split & continue" }));

    expect(router.push).toHaveBeenCalledWith({
      params: {
        recognizedDora: "9s",
        recognizedMelds: "",
        recognizedModel: "guided-crop-v0-test",
        recognizedReviewedCount: "1",
        recognizedTiles: handTiles.join(","),
        recognizedWinningIndex: "13",
        referencePhoto: "file:///guided-hand.jpg",
      },
      pathname: "/manual",
    });
  });
});
